/**
 * Geocoding Service
 * Uses OpenStreetMap Nominatim API for reverse geocoding.
 */

export const reverseGeocode = async (latitude, longitude) => {
  try {
    // OpenStreetMap Nominatim Reverse Geocoding URL
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SamadhanApp/1.0', // Required by Nominatim policy
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.address) {
      const address = data.address;
      
      // Nominatim might return area/neighborhood in different fields
      // Fallbacks: suburb -> neighborhood -> residential -> city_district -> town -> village -> road -> county
      const area = 
        address.suburb || 
        address.neighbourhood || 
        address.residential ||
        address.city_district || 
        address.town ||
        address.village ||
        address.road ||
        'Unknown Area';

      const pincode = address.postcode || '000000';
      
      const city = 
        address.city || 
        address.town || 
        address.municipality ||
        'Unknown City';

      const village = address.village || address.town || address.hamlet || address.suburb || 'Unknown Village';
      const mandal = address.county || address.state_district || address.suburb || 'Unknown Mandal';
      const district = address.state_district || address.state || 'Unknown District';

      return {
        area,
        pincode,
        city,
        village,
        mandal,
        district,
        rawAddress: data.display_name // keeping it for fallback
      };
    }

    return null;
  } catch (error) {
    console.error('[GeocodingService] Error during reverse geocoding:', error.message);
    return null;
  }
};

export default { reverseGeocode };
