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
            left: 4,
            top: 2,
            width: 52,
            height: 10,
            flexDirection: "column",
            padding: 1,
            backgroundColor: palette.rule,
          }}
        >
          <text style={{ fg: palette.ticket }}>JiraFlow Help</text>
          <text style={{ fg: palette.ink }}>Esc Back / close</text>
          <text style={{ fg: palette.ink }}>Q Quit (except destructive confirmation)</text>
          <text style={{ fg: palette.ink }}>? Toggle this help</text>
          <text style={{ fg: palette.mute }}>
            Every shortcut is also shown as a visible action.
          </text>
        </box>
      ) : null}
    </TuiServicesContext.Provider>
  );
}
