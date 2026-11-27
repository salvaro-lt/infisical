import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

import { AuthPageLayout } from "@app/components/auth/AuthPageLayout";
import { PageTitle } from "@app/components/PageTitle";

import { InitialStep } from "./components";
import { SalvaroMark, SalvaroSignIn } from "./components/SalvaroSignIn";

// Members sign in only through Salvaro's identity provider. The super admin console keeps
// Infisical's email sign-in at /login/admin so the instance stays reachable if the IdP is down.
const SalvaroLoginLayout = () => (
  <div className="relative flex min-h-dvh flex-col overflow-hidden bg-page">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [background-image:radial-gradient(color-mix(in_oklab,var(--color-foreground)_14%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)] [background-size:22px_22px]"
    />
    <header className="relative z-10 flex h-16 items-center px-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
        <SalvaroMark />
        Salvaro
      </Link>
    </header>
    <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-24">
      <div className="w-full max-w-sm">
        <SalvaroSignIn />
      </div>
    </main>
    <footer className="relative z-10 pb-6 text-center text-xs text-label">
      Secrets are stored and encrypted by Infisical.
    </footer>
  </div>
);

export const LoginPage = ({ isAdmin }: { isAdmin?: boolean }) => {
  const { t } = useTranslation();

  if (!isAdmin) {
    return (
      <>
        <PageTitle title="Sign In" />
        <SalvaroLoginLayout />
      </>
    );
  }

  return (
    <AuthPageLayout
      showFooter={false}
      bottomContent={
        <div className="text-xs text-label">
          Help me{" "}
          <Link
            to="/account-recovery"
            className="underline underline-offset-2 transition-colors duration-200 hover:text-foreground hover:decoration-project/45"
          >
            recover my account
          </Link>
        </div>
      }
    >
      <PageTitle title={t("page-titles.admin-login")} />
      <link rel="icon" href="/infisical.ico" />
      <InitialStep isAdmin />
    </AuthPageLayout>
  );
};
