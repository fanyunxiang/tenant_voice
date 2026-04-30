import { createHash, randomUUID } from 'node:crypto';
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

const SEED_TAG = 'landlord-seed-v1';
const country = 'AU';

const landlords = [
  {
    fullName: 'Olivia Mercer',
    email: 'olivia.mercer@tenantvoice.local',
    phone: '0400000001',
    agencyName: 'South Coast Rentals',
    licenseNumber: 'NSW-LIC-1001',
    portfolioSize: 7,
  },
  {
    fullName: 'Liam Gardner',
    email: 'liam.gardner@tenantvoice.local',
    phone: '0400000002',
    agencyName: 'Harbourline Property',
    licenseNumber: 'NSW-LIC-1002',
    portfolioSize: 5,
  },
  {
    fullName: 'Ava Sinclair',
    email: 'ava.sinclair@tenantvoice.local',
    phone: '0400000003',
    agencyName: 'Coastal Nest Realty',
    licenseNumber: 'NSW-LIC-1003',
    portfolioSize: 6,
  },
  {
    fullName: 'Noah Whitman',
    email: 'noah.whitman@tenantvoice.local',
    phone: '0400000004',
    agencyName: 'Metro Lease Partners',
    licenseNumber: 'NSW-LIC-1004',
    portfolioSize: 4,
  },
  {
    fullName: 'Mia Dawson',
    email: 'mia.dawson@tenantvoice.local',
    phone: '0400000005',
    agencyName: 'Blue Ridge Estates',
    licenseNumber: 'NSW-LIC-1005',
    portfolioSize: 8,
  },
];

const tenants = [
  { fullName: 'Ethan Brooks', email: 'ethan.brooks@tenantvoice.local', phone: '0411000001' },
  { fullName: 'Sophia Lane', email: 'sophia.lane@tenantvoice.local', phone: '0411000002' },
  { fullName: 'Mason Reed', email: 'mason.reed@tenantvoice.local', phone: '0411000003' },
  { fullName: 'Amelia Hart', email: 'amelia.hart@tenantvoice.local', phone: '0411000004' },
  { fullName: 'Lucas Quinn', email: 'lucas.quinn@tenantvoice.local', phone: '0411000005' },
  { fullName: 'Isla Bennett', email: 'isla.bennett@tenantvoice.local', phone: '0411000006' },
];

const reviewTemplates = [
  { title: 'Great communication and smooth process', body: 'Inspection and application flow were clear and timely.' },
  { title: 'Well-maintained and convenient', body: 'Property condition matched the listing and location is very practical.' },
  { title: 'Reliable landlord support', body: 'Questions were answered quickly and follow-up was consistent.' },
  { title: 'Comfortable place to live', body: 'Quiet surroundings and accurate listing details.' },
  { title: 'Positive renting experience', body: 'Move-in guidance was straightforward and helpful.' },
  { title: 'Excellent location and amenities', body: 'Shops and transport are close, and the home is easy to maintain.' },
  { title: 'Fair process and clear expectations', body: 'Application updates were transparent and easy to follow.' },
  { title: 'Solid value for weekly rent', body: 'Condition and rent felt balanced for the suburb.' },
];

const maintenanceTemplates = [
  { category: 'PLUMBING', severity: 'MEDIUM', description: 'Kitchen sink drain running slow and backing up occasionally.' },
  { category: 'ELECTRICAL', severity: 'HIGH', description: 'Living room ceiling light flickers intermittently.' },
  { category: 'APPLIANCE', severity: 'LOW', description: 'Range hood fan is noisier than normal during operation.' },
  { category: 'LOCKS_SECURITY', severity: 'MEDIUM', description: 'Front door lock requires multiple turns to latch.' },
  { category: 'GENERAL', severity: 'LOW', description: 'Bathroom exhaust vent cover is loose and rattles.' },
];

const maintenanceWorkers = [
  'Alex - Licensed Plumber',
  'Jordan - Electrician',
  'Casey - Appliance Technician',
  'Taylor - Locksmith',
  'Riley - General Handyperson',
];

const listingBlueprints = [
  { title: 'City Beach Apartment', propertyType: 'APARTMENT', addressLine1: '8 Crown Street', suburb: 'Wollongong', state: 'NSW', postcode: '2500', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 690 },
  { title: 'University Walk Studio', propertyType: 'STUDIO', addressLine1: '21 Foley Street', suburb: 'Gwynneville', state: 'NSW', postcode: '2500', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 510 },
  { title: 'Coastal Family House', propertyType: 'HOUSE', addressLine1: '14 Campbell Street', suburb: 'Woonona', state: 'NSW', postcode: '2517', bedrooms: 3, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 890 },
  { title: 'Figtree Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '33 Lamerton Crescent', suburb: 'Figtree', state: 'NSW', postcode: '2525', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 760 },
  { title: 'Corrimal Unit', propertyType: 'UNIT', addressLine1: '5 Underwood Street', suburb: 'Corrimal', state: 'NSW', postcode: '2518', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 640 },
  { title: 'North Wollongong Apartment', propertyType: 'APARTMENT', addressLine1: '58 Bourke Street', suburb: 'North Wollongong', state: 'NSW', postcode: '2500', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 720 },
  { title: 'Fairy Meadow Duplex', propertyType: 'DUPLEX', addressLine1: '11 Daisy Street', suburb: 'Fairy Meadow', state: 'NSW', postcode: '2519', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 790 },
  { title: 'Thirroul Cottage House', propertyType: 'HOUSE', addressLine1: '39 Railway Parade', suburb: 'Thirroul', state: 'NSW', postcode: '2515', bedrooms: 3, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 930 },
  { title: 'Austinmer Coastal Unit', propertyType: 'UNIT', addressLine1: '3 Lawrence Hargrave Drive', suburb: 'Austinmer', state: 'NSW', postcode: '2515', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 700 },
  { title: 'Unanderra Family Home', propertyType: 'HOUSE', addressLine1: '27 Princes Highway', suburb: 'Unanderra', state: 'NSW', postcode: '2526', bedrooms: 4, bathrooms: 2, parkingSpaces: 2, petFriendly: true, weeklyRent: 980 },
  { title: 'Shellharbour Marina Apartment', propertyType: 'APARTMENT', addressLine1: '17 Harbour Boulevard', suburb: 'Shellharbour', state: 'NSW', postcode: '2529', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 780 },
  { title: 'Warrawong Unit', propertyType: 'UNIT', addressLine1: '46 King Street', suburb: 'Warrawong', state: 'NSW', postcode: '2502', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 610 },
  { title: 'Dapto Duplex', propertyType: 'DUPLEX', addressLine1: '10 Osborne Street', suburb: 'Dapto', state: 'NSW', postcode: '2530', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 740 },
  { title: 'Kiama Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '6 Collins Street', suburb: 'Kiama', state: 'NSW', postcode: '2533', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 920 },
  { title: 'Balgownie Studio', propertyType: 'STUDIO', addressLine1: '2 Balgownie Road', suburb: 'Balgownie', state: 'NSW', postcode: '2519', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 480 },
  { title: 'Sydney CBD Apartment', propertyType: 'APARTMENT', addressLine1: '110 Sussex Street', suburb: 'Sydney', state: 'NSW', postcode: '2000', bedrooms: 1, bathrooms: 1, parkingSpaces: 0, petFriendly: false, weeklyRent: 980 },
  { title: 'Parramatta Family Unit', propertyType: 'UNIT', addressLine1: '18 Hassall Street', suburb: 'Parramatta', state: 'NSW', postcode: '2150', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 720 },
  { title: 'Strathfield Apartment', propertyType: 'APARTMENT', addressLine1: '44 Albert Road', suburb: 'Strathfield', state: 'NSW', postcode: '2135', bedrooms: 2, bathrooms: 1, parkingSpaces: 1, petFriendly: false, weeklyRent: 760 },
  { title: 'Burwood Townhouse', propertyType: 'TOWNHOUSE', addressLine1: '12 Railway Parade', suburb: 'Burwood', state: 'NSW', postcode: '2134', bedrooms: 3, bathrooms: 2, parkingSpaces: 1, petFriendly: true, weeklyRent: 840 },
  { title: 'Hurstville Apartment', propertyType: 'APARTMENT', addressLine1: '26 Forest Road', suburb: 'Hurstville', state: 'NSW', postcode: '2220', bedrooms: 2, bathrooms: 2, parkingSpaces: 1, petFriendly: false, weeklyRent: 730 },
];

const REVIEWS_PER_LISTING = 3;

function deterministicUuid(seedKey) {
  const hex = createHash('sha256').update(seedKey).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = hex.join('');
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

async function seed() {
  const client = new Client({
    connectionString: normalizedConnectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query('begin');

  try {
    const landlordIds = [];
    const tenantIds = [];
    const nowIso = new Date().toISOString();

    // Clean legacy seeded rows that still contain visible "Mock" or "[seed:*]" labels.
    await client.query(`delete from public.reviews where coalesce(title, '') like 'Mock Review %' or coalesce(body, '') like '%[seed:%'`);
    await client.query(`delete from public.complaints where coalesce(description, '') like '%[seed:%'`);
    await client.query(`delete from public.listings where title like 'Mock Listing %'`);
    await client.query(`delete from public.properties where coalesce(nickname, '') like 'Mock Listing %'`);

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

    for (const tenant of tenants) {
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
            'TENANT',
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
            primary_role = 'TENANT',
            status = 'ACTIVE',
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
          returning id
        `,
        [
          tenant.email,
          tenant.fullName,
          tenant.phone,
          JSON.stringify({ seedTag: SEED_TAG }),
          nowIso,
          insertedUserId,
        ],
      );

      const tenantUserId = upsertUserResult.rows[0]?.id;
      if (!tenantUserId) {
        throw new Error(`Failed to upsert tenant user: ${tenant.email}`);
      }

      tenantIds.push(tenantUserId);

      const roleAssignmentId = randomUUID();
      await client.query(
        `
          insert into public.user_role_assignments (id, user_id, role, is_primary, created_at)
          values ($1::uuid, $2::uuid, 'TENANT', true, $3::timestamptz)
          on conflict (user_id, role) do update
          set is_primary = true
        `,
        [roleAssignmentId, tenantUserId, nowIso],
      );
    }

    await client.query(
      `
        delete from public.complaints
        where coalesce(metadata->>'seedTag', '') = $1
      `,
      [SEED_TAG],
    );

    await client.query(
      `
        delete from public.reviews
        where reviewer_user_id = any($1::uuid[])
          and reviewed_user_id = any($2::uuid[])
      `,
      [tenantIds, landlordIds],
    );

    await client.query(
      `
        delete from public.listings l
        using public.properties p
        where l.property_id = p.id
          and p.owner_user_id = any($1::uuid[])
          and coalesce(p.metadata->>'seedTag', '') = $2
      `,
      [landlordIds, SEED_TAG],
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
    let createdApplications = 0;
    let createdReviews = 0;
    let createdComplaints = 0;

    for (let i = 0; i < listingBlueprints.length; i += 1) {
      const blueprint = listingBlueprints[i];
      const ownerUserId = landlordIds[i % landlordIds.length];
      const applicantUserId = tenantIds[i % tenantIds.length];
      const secondaryTenantUserId = tenantIds[(i + 1) % tenantIds.length];
      const propertyId = deterministicUuid(`${SEED_TAG}:property:${i + 1}`);
      const listingId = deterministicUuid(`${SEED_TAG}:listing:${i + 1}`);
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
          JSON.stringify({ seedTag: SEED_TAG, index: i + 1 }),
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

      const applicationId = deterministicUuid(`${SEED_TAG}:application:${i + 1}:${applicantUserId}`);
      await client.query(
        `
          insert into public.rental_applications (
            id,
            listing_id,
            applicant_user_id,
            status,
            offer_weekly_rent,
            message,
            metadata,
            submitted_at,
            last_status_at,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5::numeric,
            $6,
            $7::jsonb,
            $8::timestamptz,
            $8::timestamptz,
            $8::timestamptz,
            $8::timestamptz
          )
          on conflict (listing_id, applicant_user_id) do update
          set
            status = excluded.status,
            offer_weekly_rent = excluded.offer_weekly_rent,
            message = excluded.message,
            metadata = excluded.metadata,
            last_status_at = excluded.last_status_at,
            updated_at = excluded.updated_at
        `,
        [
          applicationId,
          listingId,
          applicantUserId,
          i % 4 === 0 ? 'APPROVED' : i % 4 === 1 ? 'UNDER_REVIEW' : 'SUBMITTED',
          blueprint.weeklyRent,
          'Interested in this property.',
          JSON.stringify({ seedTag: SEED_TAG }),
          nowIso,
        ],
      );
      createdApplications += 1;

      for (let reviewIndex = 0; reviewIndex < REVIEWS_PER_LISTING; reviewIndex += 1) {
        const reviewerUserId = tenantIds[(i + reviewIndex) % tenantIds.length];
        const replyUserId = tenantIds[(i + reviewIndex + 1) % tenantIds.length];
        const reviewTemplate = reviewTemplates[(i + reviewIndex) % reviewTemplates.length];
        const replyTemplate = reviewTemplates[(i + reviewIndex + 3) % reviewTemplates.length];

        const propertyReviewId = deterministicUuid(`${SEED_TAG}:review:tenant:${i + 1}:${reviewIndex + 1}`);
        await client.query(
          `
            insert into public.reviews (
              id,
              property_id,
              reviewer_user_id,
              reviewed_user_id,
              rating,
              title,
              body,
              is_verified_interaction,
              status,
              created_at,
              updated_at
            )
            values (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::uuid,
              $5::int,
              $6,
              $7,
              true,
              'PUBLISHED',
              $8::timestamptz,
              $8::timestamptz
            )
          `,
          [
            propertyReviewId,
            propertyId,
            reviewerUserId,
            ownerUserId,
            3 + ((i + reviewIndex) % 3),
            reviewTemplate.title,
            reviewTemplate.body,
            nowIso,
          ],
        );
        createdReviews += 1;

        const landlordReplyId = deterministicUuid(`${SEED_TAG}:review:reply:${i + 1}:${reviewIndex + 1}`);
        await client.query(
          `
            insert into public.reviews (
              id,
              property_id,
              reviewer_user_id,
              reviewed_user_id,
              rating,
              title,
              body,
              is_verified_interaction,
              status,
              created_at,
              updated_at
            )
            values (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::uuid,
              $5::int,
              $6,
              $7,
              true,
              'PUBLISHED',
              $8::timestamptz,
              $8::timestamptz
            )
          `,
          [
            landlordReplyId,
            propertyId,
            replyUserId,
            ownerUserId,
            3 + ((i + reviewIndex + 1) % 3),
            'Landlord response',
            replyTemplate.body,
            nowIso,
          ],
        );
        createdReviews += 1;
      }

      const maintenanceOpen = maintenanceTemplates[i % maintenanceTemplates.length];
      const openComplaintId = deterministicUuid(`${SEED_TAG}:complaint:open:${i + 1}`);
      await client.query(
        `
          insert into public.complaints (
            id,
            reporter_user_id,
            against_user_id,
            property_id,
            category,
            description,
            severity,
            status,
            lodged_at,
            resolved_at,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5,
            $6,
            $7,
            'OPEN',
            $8::timestamptz,
            null,
            $9::jsonb
          )
        `,
        [
          openComplaintId,
          applicantUserId,
          ownerUserId,
          propertyId,
          maintenanceOpen.category,
          maintenanceOpen.description,
          maintenanceOpen.severity,
          nowIso,
          JSON.stringify({
            seedTag: SEED_TAG,
            assignedWorker: maintenanceWorkers[i % maintenanceWorkers.length],
          }),
        ],
      );
      createdComplaints += 1;

      const maintenanceResolved = maintenanceTemplates[(i + 1) % maintenanceTemplates.length];
      const resolvedComplaintId = deterministicUuid(`${SEED_TAG}:complaint:resolved:${i + 1}`);
      const resolvedAtIso = new Date(Date.now() - (i + 2) * 86400000).toISOString();
      await client.query(
        `
          insert into public.complaints (
            id,
            reporter_user_id,
            against_user_id,
            property_id,
            category,
            description,
            severity,
            status,
            lodged_at,
            resolved_at,
            metadata
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5,
            $6,
            $7,
            'RESOLVED',
            $8::timestamptz,
            $9::timestamptz,
            $10::jsonb
          )
        `,
        [
          resolvedComplaintId,
          secondaryTenantUserId,
          ownerUserId,
          propertyId,
          maintenanceResolved.category,
          maintenanceResolved.description,
          maintenanceResolved.severity,
          nowIso,
          resolvedAtIso,
          JSON.stringify({
            seedTag: SEED_TAG,
            assignedWorker: maintenanceWorkers[(i + 1) % maintenanceWorkers.length],
          }),
        ],
      );
      createdComplaints += 1;

      createdListings += 1;
    }

    await client.query('commit');

    console.log(
      JSON.stringify({
        ok: true,
        seedTag: SEED_TAG,
        landlordsCreatedOrUpdated: landlordIds.length,
        tenantsCreatedOrUpdated: tenantIds.length,
        listingsCreated: createdListings,
        applicationsCreatedOrUpdated: createdApplications,
        reviewsCreated: createdReviews,
        maintenanceRecordsCreated: createdComplaints,
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
