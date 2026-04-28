import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnvPath = path.resolve(__dirname, '..', '.env');
const frontendEnvPath = path.resolve(__dirname, '..', '..', 'frontend', '.env.local');

config({ path: backendEnvPath });
config({ path: frontendEnvPath, override: false });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DIRECT_URL or DATABASE_URL is required.');
  process.exit(1);
}

const parsedConnectionUrl = new URL(connectionString);
const isLocalDatabase = ['localhost', '127.0.0.1'].includes(parsedConnectionUrl.hostname);
const sslMode = parsedConnectionUrl.searchParams.get('sslmode');

// pg currently treats sslmode=require as strict verification unless libpq compatibility is enabled.
if (!isLocalDatabase && sslMode === 'require' && !parsedConnectionUrl.searchParams.has('uselibpqcompat')) {
  parsedConnectionUrl.searchParams.set('uselibpqcompat', 'true');
}

const normalizedConnectionString = parsedConnectionUrl.toString();

const SEED_TAG = 'mock-landlord-v1';
const country = 'AU';

const landlords = [
  {
    fullName: 'Olivia Mercer',
    email: 'mock.landlord1@tenantvoice.local',
    phone: '0400000001',
    agencyName: 'South Coast Rentals',
    licenseNumber: 'NSW-LIC-1001',
    portfolioSize: 7,
  },
  {
    fullName: 'Liam Gardner',
    email: 'mock.landlord2@tenantvoice.local',
    phone: '0400000002',
    agencyName: 'Harbourline Property',
    licenseNumber: 'NSW-LIC-1002',
    portfolioSize: 5,
  },
  {
    fullName: 'Ava Sinclair',
    email: 'mock.landlord3@tenantvoice.local',
    phone: '0400000003',
    agencyName: 'Coastal Nest Realty',
    licenseNumber: 'NSW-LIC-1003',
    portfolioSize: 6,
  },
  {
    fullName: 'Noah Whitman',
    email: 'mock.landlord4@tenantvoice.local',
    phone: '0400000004',
    agencyName: 'Metro Lease Partners',
    licenseNumber: 'NSW-LIC-1004',
    portfolioSize: 4,
  },
  {
    fullName: 'Mia Dawson',
    email: 'mock.landlord5@tenantvoice.local',
    phone: '0400000005',
    agencyName: 'Blue Ridge Estates',
    licenseNumber: 'NSW-LIC-1005',
    portfolioSize: 8,
  },
];

const listingBlueprints = [
  { title: 'Mock Listing 01 - City Beach Apartment', propertyType: 'APARTMENT', addressLine1: '8 Crown Street', suburb: 'Wollongong', state: 'NSW', postcode: '2500', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 690 },
  { title: 'Mock Listing 02 - University Walk Studio', propertyType: 'STUDIO', addressLine1: '21 Foley Street', suburb: 'Gwynneville', state: 'NSW', postcode: '2500', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 510 },
  { title: 'Mock Listing 03 - Coastal Family House', propertyType: 'HOUSE', addressLine1: '14 Campbell Street', suburb: 'Woonona', state: 'NSW', postcode: '2517', bedrooms: 3, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 890 },
  { title: 'Mock Listing 04 - Figtree Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '33 Lamerton Crescent', suburb: 'Figtree', state: 'NSW', postcode: '2525', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 760 },
  { title: 'Mock Listing 05 - Corrimal Unit', propertyType: 'UNIT', addressLine1: '5 Underwood Street', suburb: 'Corrimal', state: 'NSW', postcode: '2518', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 640 },
  { title: 'Mock Listing 06 - North Wollongong Apartment', propertyType: 'APARTMENT', addressLine1: '58 Bourke Street', suburb: 'North Wollongong', state: 'NSW', postcode: '2500', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 720 },
  { title: 'Mock Listing 07 - Fairy Meadow Duplex', propertyType: 'DUPLEX', addressLine1: '11 Daisy Street', suburb: 'Fairy Meadow', state: 'NSW', postcode: '2519', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 790 },
  { title: 'Mock Listing 08 - Thirroul Cottage House', propertyType: 'HOUSE', addressLine1: '39 Railway Parade', suburb: 'Thirroul', state: 'NSW', postcode: '2515', bedrooms: 3, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 930 },
  { title: 'Mock Listing 09 - Austinmer Coastal Unit', propertyType: 'UNIT', addressLine1: '3 Lawrence Hargrave Drive', suburb: 'Austinmer', state: 'NSW', postcode: '2515', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 700 },
  { title: 'Mock Listing 10 - Unanderra Family Home', propertyType: 'HOUSE', addressLine1: '27 Princes Highway', suburb: 'Unanderra', state: 'NSW', postcode: '2526', bedrooms: 4, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 980 },
  { title: 'Mock Listing 11 - Shellharbour Marina Apartment', propertyType: 'APARTMENT', addressLine1: '17 Harbour Boulevard', suburb: 'Shellharbour', state: 'NSW', postcode: '2529', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 780 },
  { title: 'Mock Listing 12 - Warrawong Unit', propertyType: 'UNIT', addressLine1: '46 King Street', suburb: 'Warrawong', state: 'NSW', postcode: '2502', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 610 },
  { title: 'Mock Listing 13 - Dapto Duplex', propertyType: 'DUPLEX', addressLine1: '10 Osborne Street', suburb: 'Dapto', state: 'NSW', postcode: '2530', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 740 },
  { title: 'Mock Listing 14 - Kiama Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '6 Collins Street', suburb: 'Kiama', state: 'NSW', postcode: '2533', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 920 },
  { title: 'Mock Listing 15 - Balgownie Studio', propertyType: 'STUDIO', addressLine1: '2 Balgownie Road', suburb: 'Balgownie', state: 'NSW', postcode: '2519', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 480 },
  { title: 'Mock Listing 16 - Sydney CBD Apartment', propertyType: 'APARTMENT', addressLine1: '110 Sussex Street', suburb: 'Sydney', state: 'NSW', postcode: '2000', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 980 },
  { title: 'Mock Listing 17 - Parramatta Family Unit', propertyType: 'UNIT', addressLine1: '18 Hassall Street', suburb: 'Parramatta', state: 'NSW', postcode: '2150', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 720 },
  { title: 'Mock Listing 18 - Strathfield Apartment', propertyType: 'APARTMENT', addressLine1: '44 Albert Road', suburb: 'Strathfield', state: 'NSW', postcode: '2135', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 760 },
  { title: 'Mock Listing 19 - Burwood Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '12 Railway Parade', suburb: 'Burwood', state: 'NSW', postcode: '2134', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 840 },
  { title: 'Mock Listing 20 - Hurstville Apartment', propertyType: 'APARTMENT', addressLine1: '26 Forest Road', suburb: 'Hurstville', state: 'NSW', postcode: '2220', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 730 },
];

async function seed() {
  const client = new Client({
    connectionString: normalizedConnectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query('begin');

  try {
    const landlordIds = [];
    const nowIso = new Date().toISOString();

    for (const landlord of landlords) {
      const insertedUserId = randomUUID();
      const upsertUserResult = await client.query(
        `
          insert into public.users (
            id,
            auth_user_id,
            email,
            full_name,
            phone,
            primary_role,
            status,
            locale,
            metadata,
            created_at,
            updated_at
          )
          values (
            $6::uuid,
            null,
            $1,
            $2,
            $3,
            'LANDLORD',
            'ACTIVE',
            'en-AU',
            $4::jsonb,
            $5::timestamptz,
            $5::timestamptz
          )
          on conflict (email) do update
          set
            full_name = excluded.full_name,
            phone = excluded.phone,
            primary_role = 'LANDLORD',
            status = 'ACTIVE',
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
          returning id
        `,
        [
          landlord.email,
          landlord.fullName,
          landlord.phone,
          JSON.stringify({ seedTag: SEED_TAG }),
          nowIso,
          insertedUserId,
        ],
      );

      const userId = upsertUserResult.rows[0]?.id;
      if (!userId) {
        throw new Error(`Failed to upsert landlord user: ${landlord.email}`);
      }

      landlordIds.push(userId);

      const roleAssignmentId = randomUUID();
      await client.query(
        `
          insert into public.user_role_assignments (id, user_id, role, is_primary, created_at)
          values ($1::uuid, $2::uuid, 'LANDLORD', true, $3::timestamptz)
          on conflict (user_id, role) do update
          set is_primary = true
        `,
        [roleAssignmentId, userId, nowIso],
      );

      await client.query(
        `
          insert into public.landlord_profiles (
            user_id,
            agency_name,
            license_number,
            portfolio_size,
            verification_status,
            metadata,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2,
            $3,
            $4::int,
            'VERIFIED',
            $5::jsonb,
            $6::timestamptz,
            $6::timestamptz
          )
          on conflict (user_id) do update
          set
            agency_name = excluded.agency_name,
            license_number = excluded.license_number,
            portfolio_size = excluded.portfolio_size,
            verification_status = excluded.verification_status,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
        `,
        [
          userId,
          landlord.agencyName,
          landlord.licenseNumber,
          landlord.portfolioSize,
          JSON.stringify({ seedTag: SEED_TAG }),
          nowIso,
        ],
      );
    }

    await client.query(
      `
        delete from public.listings
        where created_by_user_id = any($1::uuid[])
          and title like 'Mock Listing %'
      `,
      [landlordIds],
    );

    await client.query(
      `
        delete from public.properties
        where owner_user_id = any($1::uuid[])
          and coalesce(metadata->>'seedTag', '') = $2
      `,
      [landlordIds, SEED_TAG],
    );

    let createdListings = 0;

    for (let i = 0; i < listingBlueprints.length; i += 1) {
      const blueprint = listingBlueprints[i];
      const ownerUserId = landlordIds[i % landlordIds.length];
      const propertyId = randomUUID();
      const listingId = randomUUID();
      const availableFrom = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);

      await client.query(
        `
          insert into public.properties (
            id,
            owner_user_id,
            manager_user_id,
            property_type,
            nickname,
            address_line_1,
            address_line_2,
            suburb,
            state,
            postcode,
            country,
            bedrooms,
            bathrooms,
            parking_spaces,
            pet_friendly,
            metadata,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2::uuid,
            null,
            $3,
            $4,
            $5,
            null,
            $6,
            $7,
            $8,
            $9,
            $10::int,
            $11::int,
            $12::int,
            $13::boolean,
            $14::jsonb,
            $15::timestamptz,
            $15::timestamptz
          )
        `,
        [
          propertyId,
          ownerUserId,
          blueprint.propertyType,
          blueprint.title,
          blueprint.addressLine1,
          blueprint.suburb,
          blueprint.state,
          blueprint.postcode,
          country,
          blueprint.bedrooms,
          blueprint.bathrooms,
          blueprint.parkingSpaces,
          blueprint.petFriendly,
          JSON.stringify({ seedTag: SEED_TAG, mock: true, index: i + 1 }),
          nowIso,
        ],
      );

      await client.query(
        `
          insert into public.listings (
            id,
            property_id,
            created_by_user_id,
            title,
            description,
            weekly_rent,
            bond_amount,
            available_from,
            lease_term_months,
            status,
            inspection_details,
            published_at,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6::numeric,
            $7::numeric,
            $8::date,
            12,
            'PUBLISHED',
            null,
            $9::timestamptz,
            $9::timestamptz,
            $9::timestamptz
          )
        `,
        [
          listingId,
          propertyId,
          ownerUserId,
          blueprint.title,
          `${blueprint.propertyType.toLowerCase()} in ${blueprint.suburb}, ready for tenant applications.`,
          blueprint.weeklyRent,
          blueprint.weeklyRent * 4,
          availableFrom,
          nowIso,
        ],
      );

      createdListings += 1;
    }

    await client.query('commit');

    console.log(
      JSON.stringify({
        ok: true,
        seedTag: SEED_TAG,
        landlordsCreatedOrUpdated: landlordIds.length,
        listingsCreated: createdListings,
      }),
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
