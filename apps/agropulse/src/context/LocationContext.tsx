import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Location from "expo-location";
import type { LatLng } from "@/lib/geo";

export type LocationStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable";

interface LocationContextValue {
  status: LocationStatus;
  coords: LatLng | null;
  simulated: boolean;
  request: () => Promise<LatLng | null>;
  simulate: (coords: LatLng | null) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [simulated, setSimulated] = useState(false);

  const request = useCallback(async (): Promise<LatLng | null> => {
    setStatus("loading");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("denied");
        setCoords(null);
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoords(point);
      setSimulated(false);
      setStatus("granted");
      return point;
    } catch {
      // GPS apagado, sin señal, etc.: nunca crasheamos (RF-06)
      setStatus("unavailable");
      setCoords(null);
      return null;
    }
  }, []);

  const simulate = useCallback((point: LatLng | null) => {
    setCoords(point);
    setSimulated(point !== null);
    setStatus(point ? "granted" : "idle");
  }, []);

  const value = useMemo(
    () => ({ status, coords, simulated, request, simulate }),
    [status, coords, simulated, request, simulate],
  );
  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useDeviceLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context)
    throw new Error(
      "useDeviceLocation debe usarse dentro de <LocationProvider>",
    );
  return context;
}
