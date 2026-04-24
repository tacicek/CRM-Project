-- Update Umzugsbox Rentals to support multiple box types
-- Change from single box_type to JSONB array of box items

-- Add new column for box items (array of {type, quantity})
ALTER TABLE umzugsbox_rentals 
ADD COLUMN IF NOT EXISTS box_items JSONB DEFAULT '[{"type": "standard", "quantity": 1}]'::jsonb;

-- Migrate existing data: convert single box_type + box_quantity to box_items array
UPDATE umzugsbox_rentals
SET box_items = jsonb_build_array(
  jsonb_build_object(
    'type', box_type::text,
    'quantity', box_quantity
  )
)
WHERE box_items IS NULL OR box_items = '[]'::jsonb;

-- Add archived_at timestamp for archiving returned boxes
ALTER TABLE umzugsbox_rentals
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create index for archived_at (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_umzugsbox_rentals_archived_at 
ON umzugsbox_rentals(archived_at) 
WHERE archived_at IS NOT NULL;

-- Create index for box_items (for queries filtering by box type)
CREATE INDEX IF NOT EXISTS idx_umzugsbox_rentals_box_items 
ON umzugsbox_rentals USING GIN (box_items);

-- Function to automatically archive returned boxes
CREATE OR REPLACE FUNCTION archive_returned_boxes()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Archive boxes that were returned more than 3 months ago and not yet archived
  UPDATE umzugsbox_rentals
  SET archived_at = now()
  WHERE status IN ('returned', 'lost', 'damaged')
    AND actual_return_date IS NOT NULL
    AND actual_return_date < CURRENT_DATE - INTERVAL '3 months'
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete archived boxes older than 3 months (runs after archiving)
CREATE OR REPLACE FUNCTION cleanup_archived_boxes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete boxes that have been archived for more than 3 months
  DELETE FROM umzugsbox_rentals
  WHERE archived_at IS NOT NULL
    AND archived_at < CURRENT_DATE - INTERVAL '3 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total box quantity from box_items JSONB
CREATE OR REPLACE FUNCTION get_total_box_quantity(box_items_json JSONB)
RETURNS INTEGER AS $$
DECLARE
  total INTEGER := 0;
  item JSONB;
BEGIN
  IF box_items_json IS NULL OR jsonb_array_length(box_items_json) = 0 THEN
    RETURN 0;
  END IF;
  
  FOR item IN SELECT * FROM jsonb_array_elements(box_items_json)
  LOOP
    total := total + COALESCE((item->>'quantity')::INTEGER, 0);
  END LOOP;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the view to use box_items
DROP VIEW IF EXISTS pending_box_pickups;
CREATE OR REPLACE VIEW pending_box_pickups AS
SELECT 
  ubr.*,
  c.company_name,
  tm.first_name as assigned_first_name,
  tm.last_name as assigned_last_name,
  tm.color_code as assigned_color,
  get_total_box_quantity(ubr.box_items) as total_box_quantity,
  CASE 
    WHEN ubr.expected_return_date < CURRENT_DATE THEN 'overdue'
    WHEN ubr.expected_return_date = CURRENT_DATE THEN 'today'
    WHEN ubr.expected_return_date = CURRENT_DATE + 1 THEN 'tomorrow'
    WHEN ubr.expected_return_date <= CURRENT_DATE + 3 THEN 'soon'
    ELSE 'upcoming'
  END as urgency
FROM umzugsbox_rentals ubr
JOIN companies c ON ubr.company_id = c.id
LEFT JOIN team_members tm ON ubr.assigned_team_member_id = tm.id
WHERE ubr.status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
  AND ubr.is_rental = true
  AND ubr.archived_at IS NULL
ORDER BY ubr.expected_return_date ASC NULLS LAST;

-- Update stats function to use box_items
CREATE OR REPLACE FUNCTION get_box_rental_stats(p_company_id UUID)
RETURNS TABLE (
  total_active INTEGER,
  overdue INTEGER,
  pickup_today INTEGER,
  pickup_this_week INTEGER,
  total_boxes_out INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE expected_return_date < CURRENT_DATE)::INTEGER as overdue,
    COUNT(*) FILTER (WHERE expected_return_date = CURRENT_DATE OR pickup_scheduled_date = CURRENT_DATE)::INTEGER as pickup_today,
    COUNT(*) FILTER (WHERE expected_return_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::INTEGER as pickup_this_week,
    COALESCE(SUM(get_total_box_quantity(box_items)), 0)::INTEGER as total_boxes_out
  FROM umzugsbox_rentals
  WHERE company_id = p_company_id
    AND status IN ('delivered', 'in_use', 'pickup_requested', 'pickup_scheduled')
    AND is_rental = true
    AND archived_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the new structure
COMMENT ON COLUMN umzugsbox_rentals.box_items IS 'Array of box items: [{"type": "standard", "quantity": 20}, {"type": "wardrobe", "quantity": 5}]';
COMMENT ON COLUMN umzugsbox_rentals.archived_at IS 'Timestamp when box was archived. Archived boxes are deleted after 3 months.';
COMMENT ON FUNCTION archive_returned_boxes() IS 'Archives returned boxes older than 3 months. Should be run daily via cron.';
COMMENT ON FUNCTION cleanup_archived_boxes() IS 'Deletes archived boxes older than 3 months. Should be run daily via cron after archive_returned_boxes().';

