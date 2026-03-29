'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with bundlers
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LeafletMapProps {
  lat: number;
  lng: number;
  onMapClick: (lat: number, lng: number) => void;
}

export default function LeafletMap({ lat, lng, onMapClick }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([lat, lng], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const marker = L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
    markerRef.current = marker;

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Force a resize after mount (fixes grey tiles in tabs)
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + map center when lat/lng change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], mapRef.current.getZoom());
  }, [lat, lng]);

  // Re-bind click handler when onMapClick changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.off('click');
    map.on('click', handler);
  }, [onMapClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
