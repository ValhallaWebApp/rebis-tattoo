-- Remove expired holds (operational maintenance)
DELETE FROM booking_holds
WHERE expires_at <= now();
