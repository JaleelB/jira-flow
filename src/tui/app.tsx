import { useTerminalDimensions } from "@opentui/react";
import { useReducer } from "react";
import type { StartupContext } from "../application/use-cases/get-startup-context";
import { palette } from "../ui/theme";
import { type TuiServices, TuiServicesContext } from "./app-context";
import {
  createNavigationState,
  navigationReducer,
  routeFromStartup,
  type TuiRoute,
} from "./navigation";
import { ManagementScreen } from "./screens/management-screen";

export function App({
  services,
  initialContext,
  initialRoute,
  onQuit,
}: {
  services: TuiServices;
  initialContext: StartupContext;
  initialRoute?: TuiRoute;
  onQuit: () => void;
}) {
  const { width, height } = useTerminalDimensions();
  const [navigation, dispatch] = useReducer(
    navigationReducer,
    initialRoute ?? routeFromStartup(initialContext),
    createNavigationState,
  );

  return (
    <TuiServicesContext.Provider value={services}>
      <ManagementScreen
        route={navigation.current}
        services={services}
        dispatch={dispatch}
        onQuit={onQuit}
      />
      {navigation.helpVisible ? (
        <box
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.canvas,
          }}
        >
          <box
            title=" JIRAFLOW HELP "
            titleColor={palette.ticket}
            style={{
              width: Math.min(62, Math.max(36, width - 6)),
              height: Math.min(14, Math.max(11, height - 4)),
              border: true,
              borderStyle: "rounded",
              borderColor: palette.ticket,
              flexDirection: "column",
              paddingX: 2,
              paddingY: 1,
              backgroundColor: palette.panel,
            }}
          >
            <text style={{ fg: palette.ink }}>
              <b>Keyboard map</b>
            </text>
            <text> </text>
            <text style={{ fg: palette.mute }}>
              <span fg={palette.ticket}>Esc</span> Go back or close this panel
            </text>
            <text style={{ fg: palette.mute }}>
              <span fg={palette.ticket}>Q</span> Quit outside input and confirmation screens
            </text>
            <text style={{ fg: palette.mute }}>
              <span fg={palette.ticket}>?</span> Toggle keyboard help
            </text>
            <text style={{ fg: palette.mute }}>
              <span fg={palette.ticket}>↑↓</span> Move through repository lists
            </text>
            <text> </text>
            <text style={{ fg: palette.info }}>Available actions always appear in the footer.</text>
          </box>
        </box>
      ) : null}
    </TuiServicesContext.Provider>
  );
}
