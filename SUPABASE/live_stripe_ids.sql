begin;

-- 0) Clean up any existing products with conflicting names (TEST products)
delete from public.products
where name in ('EXPLORER', 'STARTER', 'BUILDER', 'CHAMPION')
and id not in ('prod_SgtEmTCYKfROTo', 'prod_SgtFZrrxO3IdP7', 'prod_SgtGPsQZ79Mcej', 'prod_SgtHIEckuTjVRV');

-- 1) Ensure LIVE products exist (idempotent)
insert into public.products (id,active,name,description,display_name,plan_features,created,updated) values
  ('prod_SgtEmTCYKfROTo', true, 'EXPLORER','Entry-level users, startups, or small businesses wanting to test the platform','Explorer Plan','{}', now(), now()),
  ('prod_SgtFZrrxO3IdP7', true, 'STARTER','Small to medium-sized businesses that want to run more contests and grow their presence','Starter Plan','{}', now(), now()),
  ('prod_SgtGPsQZ79Mcej', true, 'BUILDER','Medium to large brands scaling their presence and want more contests and flexibility','Builder Plan','{}', now(), now()),
  ('prod_SgtHIEckuTjVRV', true, 'CHAMPION','Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support','Champion Plan','{}', now(), now())
on conflict (id) do update set
  active = excluded.active,
  name = excluded.name,
  description = excluded.description,
  display_name = excluded.display_name,
  plan_features = excluded.plan_features,
  updated = now()
on conflict (name) do update set
  id = excluded.id,
  active = excluded.active,
  description = excluded.description,
  display_name = excluded.display_name,
  plan_features = excluded.plan_features,
  updated = now();

-- 2) Ensure LIVE prices exist (idempotent)
insert into public.prices (id,product_id,active,unit_amount,currency,type,interval,interval_count,trial_period_days,billing_scheme,description,created,updated) values
  ('price_1RlVS3JEc43ljUHzS4i9LI2Y','prod_SgtEmTCYKfROTo',true,0,'usd','recurring','month',1,0,'per_unit','Free monthly access',now(),now()),
  ('price_1RlVT2JEc43ljUHzv7w3fJnJ','prod_SgtFZrrxO3IdP7',true,10000,'usd','recurring','month',1,0,'per_unit','Monthly billing',now(),now()),
  ('price_1RlVWNJEc43ljUHzF1hvHU6j','prod_SgtFZrrxO3IdP7',true,100000,'usd','recurring','year',1,0,'per_unit','Annual billing - Save $200',now(),now()),
  ('price_1RlVU7JEc43ljUHzZ5ranvXu','prod_SgtGPsQZ79Mcej',true,25000,'usd','recurring','month',1,0,'per_unit','Monthly billing',now(),now()),
  ('price_1RlVUMJEc43ljUHzIvgrheDm','prod_SgtGPsQZ79Mcej',true,250000,'usd','recurring','year',1,0,'per_unit','Annual billing - Save $500',now(),now()),
  ('price_1RlVVPJEc43ljUHzsGSTVwc6','prod_SgtHIEckuTjVRV',true,50000,'usd','recurring','month',1,0,'per_unit','Monthly billing',now(),now()),
  ('price_1RlVVgJEc43ljUHzyWf2569f','prod_SgtHIEckuTjVRV',true,500000,'usd','recurring','year',1,0,'per_unit','Annual billing - Save $1000',now(),now())
on conflict (id) do update set
  product_id = excluded.product_id,
  active = excluded.active,
  unit_amount = excluded.unit_amount,
  currency = excluded.currency,
  type = excluded.type,
  interval = excluded.interval,
  interval_count = excluded.interval_count,
  trial_period_days = excluded.trial_period_days,
  billing_scheme = excluded.billing_scheme,
  description = excluded.description,
  updated = now();

-- 3) Remap references in subscriptions (TEST → LIVE)
update public.subscriptions
set price_id = case price_id
  when 'price_1RqBIUDCKN2LN0Qe2c097HHM' then 'price_1RlVS3JEc43ljUHzS4i9LI2Y'
  when 'price_1RqBK8DCKN2LN0QeVe68F0Ec' then 'price_1RlVT2JEc43ljUHzv7w3fJnJ'
  when 'price_1RqBKXDCKN2LN0Qe81Nq90bP' then 'price_1RlVWNJEc43ljUHzF1hvHU6j'
  when 'price_1RqBLcDCKN2LN0QendahSoUJ' then 'price_1RlVU7JEc43ljUHzZ5ranvXu'
  when 'price_1RqBLcDCKN2LN0QeoHdipPyN' then 'price_1RlVUMJEc43ljUHzIvgrheDm'
  when 'price_1RqBMjDCKN2LN0QenUgKtYgD' then 'price_1RlVVPJEc43ljUHzsGSTVwc6'
  when 'price_1RqBMjDCKN2LN0QeFgcfIR2I' then 'price_1RlVVgJEc43ljUHzyWf2569f'
  else price_id end;

-- 4) Remap references in advertiser_profiles.subscription_info (TEST → LIVE)
update public.advertiser_profiles
set subscription_info = coalesce(subscription_info,'{}'::jsonb)
  || jsonb_build_object('product_id', case subscription_info->>'product_id'
       when 'prod_Slij7SgNUxACLp' then 'prod_SgtEmTCYKfROTo'
       when 'prod_SlilUeFqolEC7W' then 'prod_SgtFZrrxO3IdP7'
       when 'prod_Slinc7mb1e30Ef' then 'prod_SgtGPsQZ79Mcej'
       when 'prod_SlioxThbvGeLga' then 'prod_SgtHIEckuTjVRV'
       else subscription_info->>'product_id' end)
  || jsonb_build_object('price_id', case subscription_info->>'price_id'
       when 'price_1RqBIUDCKN2LN0Qe2c097HHM' then 'price_1RlVS3JEc43ljUHzS4i9LI2Y'
       when 'price_1RqBK8DCKN2LN0QeVe68F0Ec' then 'price_1RlVT2JEc43ljUHzv7w3fJnJ'
       when 'price_1RqBKXDCKN2LN0Qe81Nq90bP' then 'price_1RlVWNJEc43ljUHzF1hvHU6j'
       when 'price_1RqBLcDCKN2LN0QendahSoUJ' then 'price_1RlVU7JEc43ljUHzZ5ranvXu'
       when 'price_1RqBLcDCKN2LN0QeoHdipPyN' then 'price_1RlVUMJEc43ljUHzIvgrheDm'
       when 'price_1RqBMjDCKN2LN0QenUgKtYgD' then 'price_1RlVVPJEc43ljUHzsGSTVwc6'
       when 'price_1RqBMjDCKN2LN0QeFgcfIR2I' then 'price_1RlVVgJEc43ljUHzyWf2569f'
       else subscription_info->>'price_id' end);

-- 5) Now safely delete TEST prices not referenced anymore
delete from public.prices
where id in (
  'price_1RqBIUDCKN2LN0Qe2c097HHM','price_1RqBK8DCKN2LN0QeVe68F0Ec','price_1RqBKXDCKN2LN0Qe81Nq90bP',
  'price_1RqBLcDCKN2LN0QendahSoUJ','price_1RqBLcDCKN2LN0QeoHdipPyN',
  'price_1RqBMjDCKN2LN0QenUgKtYgD','price_1RqBMjDCKN2LN0QeFgcfIR2I'
) and id not in (select price_id from public.subscriptions);

-- 6) Delete TEST products that have no remaining prices
delete from public.products
where id in ('prod_Slij7SgNUxACLp','prod_SlilUeFqolEC7W','prod_Slinc7mb1e30Ef','prod_SlioxThbvGeLga')
and not exists (select 1 from public.prices p where p.product_id = products.id);

commit;