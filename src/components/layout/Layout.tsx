import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { pathname } = useLocation();
  const isHomepage = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      {!isHomepage && (
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
      )}
      <Header />
      <main className="flex-1 pt-24 md:pt-28 pb-0">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
