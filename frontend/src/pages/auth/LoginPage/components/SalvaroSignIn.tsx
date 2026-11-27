import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent } from "@app/components/v3";
import { cn } from "@app/components/v3/utils";
import { useServerConfig } from "@app/context";
import { LoginMethod } from "@app/hooks/api/admin/types";
import { useLastLogin } from "@app/hooks/useLastLogin";

const IDENTITY_PROVIDER_HOST = "prisijungimas.salvaro.pro";

// The rounded "S" tile used across Salvaro's own sign-in pages.
export const SalvaroMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid size-7 shrink-0 place-items-center rounded-lg bg-foreground text-sm font-bold text-background",
      className
    )}
  >
    S
  </span>
);

export const SalvaroSignIn = () => {
  const { config } = useServerConfig();
  const { saveLastLogin } = useLastLogin();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Salvaro sign-in is the instance's default organization signing in through its OIDC
  // configuration; until an admin sets both, there is nowhere to send the user.
  const orgSlug = config.defaultAuthOrgSlug;
  const isReady = Boolean(orgSlug) && config.defaultAuthOrgAuthMethod === "oidc";

  const signIn = () => {
    if (!orgSlug) return;
    setIsRedirecting(true);
    saveLastLogin({ method: LoginMethod.OIDC, identifier: { type: "orgSlug", value: orgSlug } });

    const query = new URLSearchParams({ orgSlug });
    // `infisical login` from the CLI opens this page with the port it listens on for the token.
    const callbackPort = new URLSearchParams(window.location.search).get("callback_port");
    if (callbackPort) query.set("callbackPort", callbackPort);
    window.location.assign(`/api/v1/sso/community-oidc/login?${query.toString()}`);
  };

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <SalvaroMark className="size-11 rounded-xl text-lg" />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-alliance text-2xl font-normal text-foreground">Salvaro Secrets</h1>
            <p className="text-sm text-accent">
              Sign in with your Salvaro account. Access is limited to the Salvaro team.
            </p>
          </div>
        </div>

        {isReady ? (
          <div className="flex flex-col gap-3">
            <Button variant="org" size="lg" isFullWidth isPending={isRedirecting} onClick={signIn}>
              <SalvaroMark className="size-5 rounded-md text-xs" />
              Continue with Salvaro
            </Button>
            <p className="text-center text-xs text-label">
              You will continue at <span className="font-mono">{IDENTITY_PROVIDER_HOST}</span>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>Salvaro sign-in is not set up yet</AlertTitle>
              <AlertDescription>
                An administrator needs to pick the default organization in Server Admin and enable
                OIDC for it under Organization Settings &gt; SSO.
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline" size="lg" isFullWidth>
              <Link to="/login/admin">Administrator Sign-In</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
