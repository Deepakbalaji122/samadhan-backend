import { reverseGeocode } from './src/services/geocoding.service.js';

async function run() {
  console.log('Testing reverse geocoding for 14.80052, 77.71715...');
  const result = await reverseGeocode(14.80052, 77.71715);
  console.log(result);
}

run();
