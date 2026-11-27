import { envConfig } from "@app/config/env";
import { isInfisicalCloud } from "@app/helpers/platform";

export const VersionBadge = () => {
  const version = envConfig.PLATFORM_VERSION;

  // We only display the version for on-premise instances, so we disable this
  // for cloud (US/EU instances) and also dedicated instances (they use hash versions)
  const shouldNotDisplay =
    !version ||
    isInfisicalCloud() ||
    // Decicated instances don't use semver versions, we can detect them
    // by checking if the version is a 7 character hexadecimal string
    /^[0-9a-f]{7}$/i.test(version);

  if (shouldNotDisplay) return null;

  // Upstream release notices point at Infisical's upgrade page, which does not apply to this build.
  return (
    <span className="mt-1 mr-2 hidden items-center gap-x-1.5 text-xs text-muted transition-colors hover:text-accent md:inline-flex">
      v{version}
    </span>
  );
};
