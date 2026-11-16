/**
 * FuelTrack — Cryptographic SHA-256 Protocol & Delivery ePOD Seal
 * Motor #159 / #245
 */

export async function computeSHA256(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback para Node runner tests
  try {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(text).digest('hex');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
  }
}

export async function sealFuelDeliveryEPOD(deliveryData) {
  const timestamp = new Date().toISOString();
  const payload = {
    ...deliveryData,
    sealedAt: timestamp
  };
  const sealHash = await computeSHA256(payload);
  return {
    ...payload,
    sealHash,
    verificationCode: `FT-${sealHash.slice(0, 8).toUpperCase()}`
  };
}
