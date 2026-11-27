import { ReactNode } from "react";

import { AuthPageHeader } from "@app/components/auth/AuthPageHeader";
import { Card, CardContent, CardFooter } from "@app/components/v3";

import { SignupDashboardPreview } from "./SignupDashboardPreview";

type SignupPreviewLayoutProps = {
  bottomContent?: ReactNode;
  children: ReactNode;
  headerAction?: ReactNode;
};

export const SignupPreviewLayout = ({
  bottomContent,
  children,
  headerAction
}: SignupPreviewLayoutProps) => (
  <div className="relative min-h-dvh overflow-hidden bg-page">
    <SignupDashboardPreview />
    <div className="relative z-10 flex min-h-dvh flex-col">
      <AuthPageHeader>{headerAction}</AuthPageHeader>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <Card className="max-h-[calc(100dvh-9rem)] thin-scrollbar w-full max-w-md overflow-y-auto">
          <CardContent>{children}</CardContent>
          {bottomContent ? (
            <CardFooter className="justify-center border-t pt-5 text-center">
              {bottomContent}
            </CardFooter>
          ) : null}
        </Card>
      </main>
    </div>
  </div>
);
