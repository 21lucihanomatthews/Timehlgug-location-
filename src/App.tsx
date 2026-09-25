/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, AlertCircle, Compass, ShieldAlert } from 'lucide-react';

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'denied' | 'unavailable' | 'timeout' | 'insecure'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorSubMessage, setErrorSubMessage] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Helper to update or create marker & accuracy circle without duplicates
  const updateMarkerAndCircle = useCallback((lat: number, lng: number, accuracy: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLng: [number, number] = [lat, lng];

    const userIcon = L.divIcon({
      className: 'custom-user-location-marker',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background-color: #2563eb;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 14px rgba(37, 99, 235, 0.7);
          position: relative;
        ">
          <div style="
            position: absolute;
            inset: -8px;
            border: 2px solid #2563eb;
            border-radius: 50%;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.75;
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { icon: userIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latLng, {
        radius: accuracy,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latLng);
      circleRef.current.setRadius(accuracy);
    }

    setLastUpdated(new Date());
  }, []);

  // Request browser GPS location strictly upon button press
  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setErrorMessage('Geolocation is not supported by your browser.');
      setErrorSubMessage('');
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setLocationStatus('insecure');
      setErrorMessage('GPS location requires a secure HTTPS connection.');
      setErrorSubMessage('');
      return;
    }

    setLocationStatus('loading');
    setErrorMessage('');
    setErrorSubMessage('');

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setLocationStatus('success');
        setErrorMessage('');
        setErrorSubMessage('');

        const map = mapInstanceRef.current;
        if (map) {
          map.setView([latitude, longitude], 16, { animate: true });
        }
        updateMarkerAndCircle(latitude, longitude, accuracy);
      },
      (error) => {
        if (error.code === 1) {
          setLocationStatus('denied');
          setErrorMessage('Location permission is blocked.');
          setErrorSubMessage('Allow location access for this site in your browser settings, then tap My Location again.');
        } else if (error.code === 2) {
          setLocationStatus('unavailable');
          setErrorMessage('Your device could not determine your GPS location. Make sure Location/GPS is enabled and try again.');
          setErrorSubMessage('');
        } else if (error.code === 3) {
          setLocationStatus('timeout');
          setErrorMessage('Getting your GPS location took too long. Make sure Location/GPS is enabled and try again.');
          setErrorSubMessage('');
        } else {
          setLocationStatus('unavailable');
          setErrorMessage(error.message || 'An unknown location error occurred.');
          setErrorSubMessage('');
        }
      },
      options
    );
  }, [updateMarkerAndCircle]);

  // Initialize Leaflet Map once on mount (NO automatic GPS request)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([20, 0], 2); // Default world view without fake local fallback

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-900 text-neutral-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-950 border-b border-neutral-800 z-10 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-base tracking-tight text-white">TimeGiG Map</h1>
            <p className="text-xs text-neutral-400">OpenStreetMap & Browser GPS</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleMyLocation}
            disabled={locationStatus === 'loading'}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 ${locationStatus === 'loading' ? 'animate-spin' : ''}`} />
            <span>{locationStatus === 'loading' ? 'Locating…' : 'My Location'}</span>
          </button>
        </div>
      </header>

      {/* Map Viewport & Overlays */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Status / Error Banner */}
        {locationStatus !== 'idle' && locationStatus !== 'success' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 max-w-md w-full mx-4">
            <div className={`p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start space-x-3 ${
              locationStatus === 'denied' || locationStatus === 'insecure'
                ? 'bg-amber-950/90 border-amber-800/80 text-amber-200'
                : locationStatus === 'loading'
                ? 'bg-neutral-900/90 border-neutral-800 text-neutral-200'
                : 'bg-rose-950/90 border-rose-800/80 text-rose-200'
            }`}>
              {locationStatus === 'insecure' ? (
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : locationStatus === 'loading' ? (
                <Navigation className="w-5 h-5 text-blue-400 animate-spin shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs leading-relaxed">
                <p className="font-semibold mb-0.5">
                  {locationStatus === 'loading'
                    ? 'Getting your exact location…'
                    : locationStatus === 'insecure'
                    ? 'Secure HTTPS Connection Required'
                    : errorMessage}
                </p>
                {errorSubMessage && <p className="mt-1 opacity-90">{errorSubMessage}</p>}
              </div>
              <button
                onClick={handleMyLocation}
                disabled={locationStatus === 'loading'}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer"
              >
                My Location
              </button>
            </div>
          </div>
        )}

        {/* GPS Info Floating Card */}
        {coords && locationStatus === 'success' && (
          <div className="absolute bottom-6 left-6 z-20 bg-neutral-950/85 border border-neutral-800/80 backdrop-blur-md p-4 rounded-2xl shadow-xl max-w-xs w-full text-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-400 pb-2 border-b border-neutral-800">
              <span className="flex items-center space-x-1.5 font-medium text-blue-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>Your current location</span>
              </span>
              {lastUpdated && (
                <span>{lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div>
                <span className="text-neutral-500 block">Latitude</span>
                <span className="font-mono font-medium">{coords.lat.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Longitude</span>
                <span className="font-mono font-medium">{coords.lng.toFixed(6)}</span>
              </div>
            </div>
            <div className="pt-1 flex items-center justify-between text-neutral-400 border-t border-neutral-800">
              <span>GPS accuracy</span>
              <span className="font-mono text-white font-medium">±{Math.round(coords.accuracy)} m</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
