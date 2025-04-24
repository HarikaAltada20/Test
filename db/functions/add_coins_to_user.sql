-- Function to add coins to a user's balance
CREATE OR REPLACE FUNCTION add_coins_to_user(user_id_param UUID, amount_param INTEGER)
RETURNS void AS $$
BEGIN
  -- Update the user's coin balance
  UPDATE users
  SET coins = COALESCE(coins, 0) + amount_param,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 