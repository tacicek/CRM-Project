import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const token = formData.get("token") as string;
    const roomType = formData.get("room_type") as string;

    if (!file || !token || !roomType) {
      return new Response(
        JSON.stringify({ error: "File, token, and room_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token via RPC
    const { data: session, error: sessionError } = await supabase.rpc(
      "get_besichtigung_session_by_token",
      { p_token: token }
    );

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.status === "completed" || session.status === "expired") {
      return new Response(
        JSON.stringify({ error: "Session is no longer accepting uploads" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      await supabase.rpc("update_besichtigung_session_status", {
        p_session_id: session.id,
        p_status: "expired",
      });
      return new Response(
        JSON.stringify({ error: "Session has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type + size BEFORE writing to storage
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

    if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Nicht unterstützter Dateityp (JPEG, PNG, WebP, HEIC)" }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "Datei zu gross (max. 10 MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload file to storage
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${token}/${roomType}/${timestamp}_${safeName}`;
    const fileBuffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("besichtigung-uploads")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert photo record via RPC
    const { data: photo, error: dbError } = await supabase.rpc(
      "insert_besichtigung_photo",
      {
        p_session_id: session.id,
        p_storage_path: uploadData.path,
        p_filename: file.name,
        p_file_size: file.size,
        p_mime_type: file.type,
        p_room_type: roomType,
      }
    );

    if (dbError) {
      console.error("Database insert error:", dbError);
      await supabase.storage.from("besichtigung-uploads").remove([storagePath]);
      return new Response(
        JSON.stringify({ error: "Failed to save photo record", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session status to uploading if pending
    if (session.status === "pending") {
      await supabase.rpc("update_besichtigung_session_status", {
        p_session_id: session.id,
        p_status: "uploading",
      });
    }

    return new Response(
      JSON.stringify({ photo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error uploading photo:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
