import logo from "@/assets/weber_logo.png";
import { useEffect, useState } from "react";

interface AppLogoProps {
  className?: string;
}

let cachedVersion: string | null = null;
let versionRequest: Promise<string> | null = null;

export function AppLogo({ className = "" }: AppLogoProps) {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    getAppVersion().then((appVersion) => {
      if (mounted) {
        setVersion(appVersion);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="grid size-8 place-items-center rounded bg-secondary p-1">
        <img src={logo} alt="NEXUS Logo" />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-tight">WEBER NEXUS</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          WEBERCOM TECH {version ? `· v${version}` : ""}
        </div>
      </div>
    </div>
  );
}

function getAppVersion(): Promise<string> {
  if (cachedVersion !== null) {
    return Promise.resolve(cachedVersion);
  }

  versionRequest ??= window.electron.app.getVersion().then((version) => {
    cachedVersion = version;
    return version;
  });

  return versionRequest;
}
