-- Function to increment a column value in a table
CREATE OR REPLACE FUNCTION increment(table_name text, column_name text, row_id uuid)
RETURNS void AS $$
DECLARE
  sql text;
BEGIN
  sql := format('UPDATE %I SET %I = %I + 1 WHERE id = %L',
               table_name, column_name, column_name, row_id);
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initial subscription plans setup
INSERT INTO subscription_plans (id, name, price, json_features)
VALUES 
  (gen_random_uuid(), 'free', 10000, '{
    "maxActiveContests": 1,
    "minContestBudget": 10000,
    "maxWinnersPerContest": 10,
    "commissionPercentage": 40
  }'),
  (gen_random_uuid(), 'bronze', 10000, '{
    "maxActiveContests": 5,
    "minContestBudget": 10000,
    "maxWinnersPerContest": 10,
    "commissionPercentage": 20
  }'),
  (gen_random_uuid(), 'silver', 20000, '{
    "maxActiveContests": 10,
    "minContestBudget": 7500,
    "maxWinnersPerContest": 20,
    "commissionPercentage": 15
  }'),
  (gen_random_uuid(), 'gold', 30000, '{
    "maxActiveContests": 20,
    "minContestBudget": 5000,
    "maxWinnersPerContest": 30,
    "commissionPercentage": 12
  }'),
  (gen_random_uuid(), 'platinum', 40000, '{
    "maxActiveContests": 30,
    "minContestBudget": 5000,
    "maxWinnersPerContest": 50,
    "commissionPercentage": 10
  }'),
  (gen_random_uuid(), 'diamond', 50000, '{
    "maxActiveContests": 100,
    "minContestBudget": 5000,
    "maxWinnersPerContest": 100,
    "commissionPercentage": 10
  }')
ON CONFLICT (name) DO NOTHING; 