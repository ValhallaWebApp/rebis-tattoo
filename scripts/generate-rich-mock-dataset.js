const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..');

const nowIso = new Date().toISOString();

const levelPresets = {
  junior: {
    canManageRoles: false,
    canManageBookings: true,
    canManageProjects: false,
    canManageSessions: false,
    canReassignProjectArtist: false,
    canReassignProjectClient: false
  },
  operator: {
    canManageRoles: false,
    canManageBookings: true,
    canManageProjects: true,
    canManageSessions: true,
    canReassignProjectArtist: false,
    canReassignProjectClient: false
  },
  senior: {
    canManageRoles: false,
    canManageBookings: true,
    canManageProjects: true,
    canManageSessions: true,
    canReassignProjectArtist: true,
    canReassignProjectClient: true
  },
  manager: {
    canManageRoles: true,
    canManageBookings: true,
    canManageProjects: true,
    canManageSessions: true,
    canReassignProjectArtist: true,
    canReassignProjectClient: true
  }
};

function toMap(items) {
  const out = {};
  for (const item of items) out[item.id] = item;
  return out;
}

function ms(dateIso) {
  return new Date(dateIso).getTime();
}

const users = [
  {
    id: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    uid: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    email: 'valhallawebapp@gmail.com',
    name: 'Sara Pushi',
    role: 'admin',
    isActive: true,
    isVisible: true,
    phone: '+39 340 099 8312',
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/1.jpg'
  },
  {
    id: 'adm_admin_02',
    uid: 'adm_admin_02',
    email: 'admin.ops@rebistattoo.it',
    name: 'Admin Operations',
    role: 'admin',
    isActive: true,
    isVisible: true,
    phone: '+39 340 000 0202',
    createdAt: '2026-02-10T08:05:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/2.jpg'
  },
  {
    id: 'stf_junior_01',
    uid: 'stf_junior_01',
    email: 'staff.junior@rebistattoo.it',
    name: 'Alessio Junior',
    role: 'staff',
    staffLevel: 'junior',
    permissions: levelPresets.junior,
    isActive: true,
    isVisible: true,
    phone: '+39 340 111 0001',
    createdAt: '2026-02-10T08:10:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/1.jpg'
  },
  {
    id: 'stf_test_01',
    uid: 'stf_test_01',
    email: 'staff.test@rebistattoo.it',
    name: 'Martina Bianchi',
    role: 'staff',
    staffLevel: 'operator',
    permissions: levelPresets.operator,
    isActive: true,
    isVisible: true,
    phone: '+39 340 111 0002',
    createdAt: '2026-02-10T08:12:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/2.jpg'
  },
  {
    id: 'stf_senior_01',
    uid: 'stf_senior_01',
    email: 'staff.senior@rebistattoo.it',
    name: 'Diego Senior',
    role: 'staff',
    staffLevel: 'senior',
    permissions: levelPresets.senior,
    isActive: true,
    isVisible: true,
    phone: '+39 340 111 0003',
    createdAt: '2026-02-10T08:14:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/3.jpg'
  },
  {
    id: 'stf_manager_01',
    uid: 'stf_manager_01',
    email: 'staff.manager@rebistattoo.it',
    name: 'Luca Manager',
    role: 'staff',
    staffLevel: 'manager',
    permissions: levelPresets.manager,
    isActive: true,
    isVisible: true,
    phone: '+39 340 111 0004',
    createdAt: '2026-02-10T08:16:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/1.jpg'
  },
  {
    id: 'cli_01',
    uid: 'cli_01',
    email: 'cliente.alfa@rebistattoo.it',
    name: 'Giulia Conti',
    role: 'client',
    isActive: true,
    isVisible: true,
    phone: '+39 333 001 0001',
    createdAt: '2026-02-10T08:20:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/1.jpg'
  },
  {
    id: 'cli_02',
    uid: 'cli_02',
    email: 'cliente.beta@rebistattoo.it',
    name: 'Marco Serra',
    role: 'client',
    isActive: true,
    isVisible: true,
    phone: '+39 333 001 0002',
    createdAt: '2026-02-10T08:22:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/2.jpg'
  },
  {
    id: 'cli_03',
    uid: 'cli_03',
    email: 'cliente.gamma@rebistattoo.it',
    name: 'Valentina Piras',
    role: 'client',
    isActive: true,
    isVisible: true,
    phone: '+39 333 001 0003',
    createdAt: '2026-02-10T08:24:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/3.jpg'
  },
  {
    id: 'cli_04',
    uid: 'cli_04',
    email: 'cliente.delta@rebistattoo.it',
    name: 'Elena Mereu',
    role: 'client',
    isActive: true,
    isVisible: true,
    phone: '+39 333 001 0004',
    createdAt: '2026-02-10T08:26:00.000Z',
    updatedAt: nowIso,
    urlAvatar: '/personale/1.jpg'
  }
];

const staffProfiles = {
  stf_junior_01: {
    id: 'stf_junior_01',
    userId: 'stf_junior_01',
    name: 'Alessio Junior',
    role: 'guest',
    bio: 'Junior in formazione, focus su preparazione sessioni.',
    photoUrl: '/personale/1.jpg',
    isActive: true,
    deletedAt: null
  },
  stf_test_01: {
    id: 'stf_test_01',
    userId: 'stf_test_01',
    name: 'Martina Operator',
    role: 'tatuatore',
    bio: 'Operatore full-time su progetti linework.',
    photoUrl: '/personale/2.jpg',
    isActive: true,
    deletedAt: null
  },
  stf_senior_01: {
    id: 'stf_senior_01',
    userId: 'stf_senior_01',
    name: 'Diego Senior',
    role: 'piercer',
    bio: 'Senior su progetti complessi e riassegnazioni.',
    photoUrl: '/personale/3.jpg',
    isActive: true,
    deletedAt: null
  },
  stf_manager_01: {
    id: 'stf_manager_01',
    userId: 'stf_manager_01',
    name: 'Luca Manager',
    role: 'tatuatore',
    bio: 'Manager di team, supervisione operativa.',
    photoUrl: '/personale/1.jpg',
    isActive: true,
    deletedAt: null
  }
};

const services = {
  svc_01: {
    id: 'svc_01',
    name: 'Consulenza Tattoo',
    description: 'Analisi idea, area, budget e piano sessioni.',
    categoria: 'Consultazione',
    prezzo: 50,
    durata: 45,
    visibile: true,
    prezzoDaConcordare: false,
    durataDaConcordare: false,
    icon: '/home/icon-01-80x80.png',
    createdAt: ms('2026-02-11T09:00:00.000Z'),
    updatedAt: ms('2026-02-11T09:00:00.000Z'),
    creatoreId: 'Nhmp6AN2ehPksUbP4mlCskNirA83'
  },
  svc_02: {
    id: 'svc_02',
    name: 'Linework Session',
    description: 'Impostazione linee e struttura del tatuaggio.',
    categoria: 'Tattoo',
    prezzo: 190,
    durata: 120,
    visibile: true,
    prezzoDaConcordare: false,
    durataDaConcordare: false,
    icon: '/home/icon-02-80x80.png',
    createdAt: ms('2026-02-11T09:10:00.000Z'),
    updatedAt: ms('2026-02-11T09:10:00.000Z'),
    creatoreId: 'Nhmp6AN2ehPksUbP4mlCskNirA83'
  },
  svc_03: {
    id: 'svc_03',
    name: 'Color Session',
    description: 'Sessione colore e saturazione.',
    categoria: 'Tattoo',
    prezzo: 260,
    durata: 180,
    visibile: true,
    prezzoDaConcordare: false,
    durataDaConcordare: false,
    icon: '/home/icon-03-80x80.png',
    createdAt: ms('2026-02-11T09:20:00.000Z'),
    updatedAt: ms('2026-02-11T09:20:00.000Z'),
    creatoreId: 'adm_admin_02'
  },
  svc_04: {
    id: 'svc_04',
    name: 'Cover-Up Specialist',
    description: 'Copertura tatuaggio preesistente con nuovo design.',
    categoria: 'Tattoo',
    prezzo: 320,
    durata: 210,
    visibile: true,
    prezzoDaConcordare: false,
    durataDaConcordare: false,
    icon: '/home/icon-04-80x80.png',
    createdAt: ms('2026-02-11T09:30:00.000Z'),
    updatedAt: ms('2026-02-11T09:30:00.000Z'),
    creatoreId: 'adm_admin_02'
  },
  svc_05: {
    id: 'svc_05',
    name: 'Piercing Premium',
    description: 'Sessione piercing con controllo guarigione.',
    categoria: 'Piercing',
    prezzo: 110,
    durata: 60,
    visibile: true,
    prezzoDaConcordare: false,
    durataDaConcordare: false,
    icon: '/home/icon-05-80x80.png',
    createdAt: ms('2026-02-11T09:40:00.000Z'),
    updatedAt: ms('2026-02-11T09:40:00.000Z'),
    creatoreId: 'Nhmp6AN2ehPksUbP4mlCskNirA83'
  }
};

const projects = {
  prj_001: {
    id: 'prj_001',
    title: 'Dragon Sleeve',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_01',
    bookingId: 'bk_001',
    sessionIds: ['ses_001', 'ses_002', 'ses_003'],
    zone: 'Braccio completo',
    placement: 'Destro',
    notes: 'Progetto titolare ad alta complessita.',
    status: 'active',
    createdAt: '2026-02-12T10:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: true,
    style: 'Orientale',
    subject: 'Drago e onde',
    imageUrls: ['https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=900&q=80']
  },
  prj_002: {
    id: 'prj_002',
    title: 'Minimal Script',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_02',
    sessionIds: ['ses_004'],
    zone: 'Clavicola',
    placement: 'Sinistra',
    notes: 'Progetto titolare rapido senza booking dedicato.',
    status: 'draft',
    createdAt: '2026-02-12T11:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: false,
    style: 'Fine Line',
    subject: 'Testo personalizzato',
    imageUrls: []
  },
  prj_003: {
    id: 'prj_003',
    title: 'Geometric Wolf',
    artistId: 'stf_junior_01',
    clientId: 'cli_03',
    bookingId: 'bk_002',
    sessionIds: ['ses_005', 'ses_006'],
    zone: 'Avambraccio',
    placement: 'Sinistro',
    notes: 'Progetto staff junior supervisionato.',
    status: 'scheduled',
    createdAt: '2026-02-12T12:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: true,
    style: 'Geometrico',
    subject: 'Lupo',
    imageUrls: ['https://images.unsplash.com/photo-1590246815117-62c3f783eec0?auto=format&fit=crop&w=900&q=80']
  },
  prj_004: {
    id: 'prj_004',
    title: 'Ornamental Shoulder',
    artistId: 'stf_test_01',
    clientId: 'cli_04',
    bookingId: 'bk_003',
    sessionIds: ['ses_007', 'ses_008'],
    zone: 'Spalla',
    placement: 'Destra',
    notes: 'Creato da staff operator.',
    status: 'active',
    createdAt: '2026-02-12T13:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: true,
    style: 'Ornamental',
    subject: 'Mandala',
    imageUrls: []
  },
  prj_005: {
    id: 'prj_005',
    title: 'Cover Up Raven',
    artistId: 'stf_senior_01',
    clientId: 'cli_01',
    bookingId: 'bk_004',
    sessionIds: ['ses_009', 'ses_010'],
    zone: 'Polpaccio',
    placement: 'Destro',
    notes: 'Prenotazione originata da chat.',
    status: 'healing',
    createdAt: '2026-02-12T14:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: false,
    style: 'Cover Up',
    subject: 'Corvo',
    imageUrls: []
  },
  prj_006: {
    id: 'prj_006',
    title: 'Neotraditional Rose',
    artistId: 'stf_manager_01',
    clientId: 'cli_02',
    bookingId: 'bk_005',
    sessionIds: ['ses_011', 'ses_012'],
    zone: 'Coscia',
    placement: 'Sinistra',
    notes: 'Booking creato da admin operations.',
    status: 'completed',
    createdAt: '2026-02-12T15:00:00',
    updatedAt: '2026-02-15T11:00:00',
    isPublic: true,
    style: 'Neotraditional',
    subject: 'Rosa',
    imageUrls: ['https://images.unsplash.com/photo-1542727365-19732a80dcfd?auto=format&fit=crop&w=900&q=80']
  }
};

const bookings = {
  bk_001: {
    id: 'bk_001',
    clientId: 'cli_01',
    idClient: 'cli_01',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    idArtist: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    projectId: 'prj_001',
    type: 'session',
    source: 'manual',
    title: 'Dragon Sleeve - Kickoff',
    start: '2026-02-18T10:00:00',
    end: '2026-02-18T13:00:00',
    notes: 'Creato dalla titolare.',
    description: 'Creato dalla titolare.',
    status: 'confirmed',
    price: 900,
    depositRequired: 200,
    paidAmount: 200,
    createdAt: '2026-02-12T10:10:00',
    updatedAt: '2026-02-15T10:00:00',
    createdBy: 'Nhmp6AN2ehPksUbP4mlCskNirA83'
  },
  bk_002: {
    id: 'bk_002',
    clientId: 'cli_03',
    idClient: 'cli_03',
    artistId: 'stf_junior_01',
    idArtist: 'stf_junior_01',
    projectId: 'prj_003',
    type: 'session',
    source: 'fast-booking',
    title: 'Geometric Wolf - Fast booking',
    start: '2026-02-19T11:00:00',
    end: '2026-02-19T13:00:00',
    notes: 'Origine fast-booking.',
    description: 'Origine fast-booking.',
    status: 'pending',
    price: 380,
    depositRequired: 80,
    paidAmount: 80,
    createdAt: '2026-02-12T12:10:00',
    updatedAt: '2026-02-15T10:05:00',
    createdBy: 'cli_03'
  },
  bk_003: {
    id: 'bk_003',
    clientId: 'cli_04',
    idClient: 'cli_04',
    artistId: 'stf_test_01',
    idArtist: 'stf_test_01',
    projectId: 'prj_004',
    type: 'session',
    source: 'manual',
    title: 'Ornamental Shoulder - Staff entry',
    start: '2026-02-20T09:00:00',
    end: '2026-02-20T12:00:00',
    notes: 'Inserito da staff operator.',
    description: 'Inserito da staff operator.',
    status: 'in_progress',
    price: 420,
    depositRequired: 100,
    paidAmount: 100,
    createdAt: '2026-02-12T13:10:00',
    updatedAt: '2026-02-15T10:10:00',
    createdBy: 'stf_test_01'
  },
  bk_004: {
    id: 'bk_004',
    clientId: 'cli_01',
    idClient: 'cli_01',
    artistId: 'stf_senior_01',
    idArtist: 'stf_senior_01',
    projectId: 'prj_005',
    type: 'session',
    source: 'chat-bot',
    title: 'Cover Up Raven - Chat lead',
    start: '2026-02-21T14:00:00',
    end: '2026-02-21T17:00:00',
    notes: 'Lead arrivato dalla chat.',
    description: 'Lead arrivato dalla chat.',
    status: 'paid',
    price: 520,
    depositRequired: 150,
    paidAmount: 520,
    createdAt: '2026-02-12T14:10:00',
    updatedAt: '2026-02-15T10:15:00',
    createdBy: 'cli_01'
  },
  bk_005: {
    id: 'bk_005',
    clientId: 'cli_02',
    idClient: 'cli_02',
    artistId: 'stf_manager_01',
    idArtist: 'stf_manager_01',
    projectId: 'prj_006',
    type: 'session',
    source: 'manual',
    title: 'Neotraditional Rose - Admin slot',
    start: '2026-02-22T15:00:00',
    end: '2026-02-22T18:00:00',
    notes: 'Prenotazione creata da admin operations.',
    description: 'Prenotazione creata da admin operations.',
    status: 'completed',
    price: 600,
    depositRequired: 150,
    paidAmount: 600,
    createdAt: '2026-02-12T15:10:00',
    updatedAt: '2026-02-15T10:20:00',
    createdBy: 'adm_admin_02'
  },
  bk_006: {
    id: 'bk_006',
    clientId: 'cli_04',
    idClient: 'cli_04',
    artistId: 'stf_manager_01',
    idArtist: 'stf_manager_01',
    type: 'consultation',
    source: 'chat-bot',
    title: 'Consulto via chat',
    start: '2026-02-25T10:00:00',
    end: '2026-02-25T10:45:00',
    notes: 'Consulenza non ancora collegata a progetto.',
    description: 'Consulenza non ancora collegata a progetto.',
    status: 'draft',
    price: 50,
    depositRequired: 0,
    paidAmount: 0,
    createdAt: '2026-02-14T09:00:00',
    updatedAt: '2026-02-14T09:00:00',
    createdBy: 'cli_04'
  }
};

const sessions = {
  ses_001: {
    id: 'ses_001',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    idArtist: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_01',
    idClient: 'cli_01',
    projectId: 'prj_001',
    bookingId: 'bk_001',
    sessionNumber: 1,
    start: '2026-02-18T10:00:00',
    end: '2026-02-18T13:00:00',
    notesByAdmin: 'Traccia linee base.',
    price: 300,
    paidAmount: 200,
    status: 'completed',
    createdAt: '2026-02-18T13:05:00',
    updatedAt: '2026-02-18T13:05:00'
  },
  ses_002: {
    id: 'ses_002',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    idArtist: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_01',
    idClient: 'cli_01',
    projectId: 'prj_001',
    bookingId: 'bk_001',
    sessionNumber: 2,
    start: '2026-02-24T10:00:00',
    end: '2026-02-24T13:00:00',
    notesByAdmin: 'Sfumature e dettagli.',
    price: 300,
    paidAmount: 200,
    status: 'planned',
    createdAt: '2026-02-18T13:10:00',
    updatedAt: '2026-02-18T13:10:00'
  },
  ses_003: {
    id: 'ses_003',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    idArtist: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_01',
    idClient: 'cli_01',
    projectId: 'prj_001',
    bookingId: 'bk_001',
    sessionNumber: 3,
    start: '2026-03-02T10:00:00',
    end: '2026-03-02T13:00:00',
    notesByAdmin: 'Chiusura progetto.',
    price: 300,
    paidAmount: 0,
    status: 'planned',
    createdAt: '2026-02-18T13:15:00',
    updatedAt: '2026-02-18T13:15:00'
  },
  ses_004: {
    id: 'ses_004',
    artistId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    idArtist: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
    clientId: 'cli_02',
    idClient: 'cli_02',
    projectId: 'prj_002',
    sessionNumber: 1,
    start: '2026-02-23T12:00:00',
    end: '2026-02-23T13:30:00',
    notesByAdmin: 'Singola sessione senza booking.',
    price: 180,
    paidAmount: 0,
    status: 'planned',
    createdAt: '2026-02-12T11:20:00',
    updatedAt: '2026-02-12T11:20:00'
  },
  ses_005: {
    id: 'ses_005',
    artistId: 'stf_junior_01',
    idArtist: 'stf_junior_01',
    clientId: 'cli_03',
    idClient: 'cli_03',
    projectId: 'prj_003',
    bookingId: 'bk_002',
    sessionNumber: 1,
    start: '2026-02-19T11:00:00',
    end: '2026-02-19T13:00:00',
    notesByAdmin: 'Preparazione linee.',
    price: 190,
    paidAmount: 80,
    status: 'completed',
    createdAt: '2026-02-19T13:05:00',
    updatedAt: '2026-02-19T13:05:00'
  },
  ses_006: {
    id: 'ses_006',
    artistId: 'stf_junior_01',
    idArtist: 'stf_junior_01',
    clientId: 'cli_03',
    idClient: 'cli_03',
    projectId: 'prj_003',
    bookingId: 'bk_002',
    sessionNumber: 2,
    start: '2026-02-27T11:00:00',
    end: '2026-02-27T13:00:00',
    notesByAdmin: 'Rifinitura.',
    price: 190,
    paidAmount: 0,
    status: 'planned',
    createdAt: '2026-02-19T13:10:00',
    updatedAt: '2026-02-19T13:10:00'
  },
  ses_007: {
    id: 'ses_007',
    artistId: 'stf_test_01',
    idArtist: 'stf_test_01',
    clientId: 'cli_04',
    idClient: 'cli_04',
    projectId: 'prj_004',
    bookingId: 'bk_003',
    sessionNumber: 1,
    start: '2026-02-20T09:00:00',
    end: '2026-02-20T12:00:00',
    notesByAdmin: 'Sessione base ornamental.',
    price: 210,
    paidAmount: 100,
    status: 'completed',
    createdAt: '2026-02-20T12:05:00',
    updatedAt: '2026-02-20T12:05:00'
  },
  ses_008: {
    id: 'ses_008',
    artistId: 'stf_test_01',
    idArtist: 'stf_test_01',
    clientId: 'cli_04',
    idClient: 'cli_04',
    projectId: 'prj_004',
    bookingId: 'bk_003',
    sessionNumber: 2,
    start: '2026-02-28T09:00:00',
    end: '2026-02-28T12:00:00',
    notesByAdmin: 'Completamento dettagli.',
    price: 210,
    paidAmount: 0,
    status: 'planned',
    createdAt: '2026-02-20T12:10:00',
    updatedAt: '2026-02-20T12:10:00'
  },
  ses_009: {
    id: 'ses_009',
    artistId: 'stf_senior_01',
    idArtist: 'stf_senior_01',
    clientId: 'cli_01',
    idClient: 'cli_01',
    projectId: 'prj_005',
    bookingId: 'bk_004',
    sessionNumber: 1,
    start: '2026-02-21T14:00:00',
    end: '2026-02-21T17:00:00',
    notesByAdmin: 'Prima copertura.',
    price: 260,
    paidAmount: 260,
    status: 'completed',
    createdAt: '2026-02-21T17:05:00',
    updatedAt: '2026-02-21T17:05:00'
  },
  ses_010: {
    id: 'ses_010',
    artistId: 'stf_senior_01',
    idArtist: 'stf_senior_01',
    clientId: 'cli_01',
    idClient: 'cli_01',
    projectId: 'prj_005',
    bookingId: 'bk_004',
    sessionNumber: 2,
    start: '2026-03-01T14:00:00',
    end: '2026-03-01T17:00:00',
    notesByAdmin: 'Definizione e ombre.',
    price: 260,
    paidAmount: 0,
    status: 'planned',
    createdAt: '2026-02-21T17:10:00',
    updatedAt: '2026-02-21T17:10:00'
  },
  ses_011: {
    id: 'ses_011',
    artistId: 'stf_manager_01',
    idArtist: 'stf_manager_01',
    clientId: 'cli_02',
    idClient: 'cli_02',
    projectId: 'prj_006',
    bookingId: 'bk_005',
    sessionNumber: 1,
    start: '2026-02-22T15:00:00',
    end: '2026-02-22T18:00:00',
    notesByAdmin: 'Sessione 1 completata.',
    price: 300,
    paidAmount: 300,
    status: 'completed',
    createdAt: '2026-02-22T18:05:00',
    updatedAt: '2026-02-22T18:05:00'
  },
  ses_012: {
    id: 'ses_012',
    artistId: 'stf_manager_01',
    idArtist: 'stf_manager_01',
    clientId: 'cli_02',
    idClient: 'cli_02',
    projectId: 'prj_006',
    bookingId: 'bk_005',
    sessionNumber: 2,
    start: '2026-03-03T15:00:00',
    end: '2026-03-03T18:00:00',
    notesByAdmin: 'Sessione finale.',
    price: 300,
    paidAmount: 300,
    status: 'completed',
    createdAt: '2026-03-03T18:05:00',
    updatedAt: '2026-03-03T18:05:00'
  }
};

const projectReviewSeed = [
  ['rev_001', 'prj_001', 'bk_001', 'cli_01', 'Nhmp6AN2ehPksUbP4mlCskNirA83', 5, 'Lavoro impeccabile, super soddisfatta.', 'approved'],
  ['rev_002', 'prj_001', 'bk_001', 'cli_01', 'Nhmp6AN2ehPksUbP4mlCskNirA83', 4, 'Sessioni ben organizzate e puntuali.', 'approved'],
  ['rev_003', 'prj_002', null, 'cli_02', 'Nhmp6AN2ehPksUbP4mlCskNirA83', 5, 'Consulto chiaro e risultato delicato.', 'pending'],
  ['rev_004', 'prj_002', null, 'cli_02', 'Nhmp6AN2ehPksUbP4mlCskNirA83', 4, 'Molto professionale.', 'approved'],
  ['rev_005', 'prj_003', 'bk_002', 'cli_03', 'stf_junior_01', 4, 'Ottima esperienza da fast booking.', 'approved'],
  ['rev_006', 'prj_003', 'bk_002', 'cli_03', 'stf_junior_01', 5, 'Junior molto preciso.', 'approved'],
  ['rev_007', 'prj_004', 'bk_003', 'cli_04', 'stf_test_01', 4, 'Staff disponibile, buon lavoro.', 'approved'],
  ['rev_008', 'prj_004', 'bk_003', 'cli_04', 'stf_test_01', 3, 'Attesa lunga ma risultato buono.', 'pending'],
  ['rev_009', 'prj_005', 'bk_004', 'cli_01', 'stf_senior_01', 5, 'Chat utile e progetto perfetto.', 'approved'],
  ['rev_010', 'prj_005', 'bk_004', 'cli_01', 'stf_senior_01', 4, 'Cover-up riuscito.', 'approved'],
  ['rev_011', 'prj_006', 'bk_005', 'cli_02', 'stf_manager_01', 5, 'Gestione manager top.', 'approved'],
  ['rev_012', 'prj_006', 'bk_005', 'cli_02', 'stf_manager_01', 4, 'Molto bene dall inizio alla fine.', 'approved']
];

const reviews = {};
for (let i = 0; i < projectReviewSeed.length; i += 1) {
  const [id, projectId, bookingId, userId, artistId, rating, comment, status] = projectReviewSeed[i];
  const p = projects[projectId];
  reviews[id] = {
    id,
    userId,
    tattooId: projectId,
    tattooTitle: p.title,
    comment,
    rating,
    status,
    date: ms(`2026-02-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`),
    bookingId: bookingId || undefined,
    artistId
  };
}

const notifications = {
  cli_01: {
    ntf_001: {
      id: 'ntf_001',
      type: 'booking',
      title: 'Booking confermato',
      message: 'La prenotazione bk_001 e confermata.',
      link: '/dashboard/booking-history',
      createdAt: '2026-02-15T09:00:00.000Z',
      readAt: null
    }
  },
  stf_test_01: {
    ntf_002: {
      id: 'ntf_002',
      type: 'chat',
      title: 'Nuovo messaggio',
      message: 'Hai un nuovo messaggio su conv_001.',
      link: '/staff',
      createdAt: '2026-02-15T09:30:00.000Z',
      readAt: null
    }
  }
};

const conversations = {
  conv_001: {
    id: 'conv_001',
    bookingId: 'bk_004',
    projectId: 'prj_005',
    clientId: 'cli_01',
    staffId: 'stf_senior_01',
    participantIds: ['cli_01', 'stf_senior_01'],
    status: 'open',
    lastMessageText: 'Confermo la sessione di domenica.',
    lastMessageAt: '2026-02-15T09:20:00.000Z',
    createdAt: '2026-02-14T11:00:00.000Z',
    createdBy: 'cli_01'
  }
};

const messages = {
  conv_001: {
    msg_001: {
      id: 'msg_001',
      conversationId: 'conv_001',
      senderId: 'cli_01',
      senderRole: 'client',
      text: 'Posso anticipare di 30 minuti?',
      createdAt: '2026-02-15T09:10:00.000Z'
    },
    msg_002: {
      id: 'msg_002',
      conversationId: 'conv_001',
      senderId: 'stf_senior_01',
      senderRole: 'staff',
      text: 'Si, confermato alle 13:30.',
      createdAt: '2026-02-15T09:20:00.000Z'
    }
  }
};

const userConversations = {
  cli_01: { conv_001: '2026-02-15T09:20:00.000Z' },
  stf_senior_01: { conv_001: '2026-02-15T09:20:00.000Z' }
};

const chats = {
  chat_001: {
    id: 'chat_001',
    email: 'cliente.alfa@rebistattoo.it',
    status: 'aperto',
    createAt: '2026-02-14T10:00:00.000Z',
    messages: {
      cmsg_001: {
        id: 'cmsg_001',
        from: 'user',
        text: 'Vorrei un cover-up',
        timestamp: '2026-02-14T10:00:00.000Z'
      },
      cmsg_002: {
        id: 'cmsg_002',
        from: 'bot',
        text: 'Ti propongo una consulenza il 21/02.',
        timestamp: '2026-02-14T10:01:00.000Z'
      }
    }
  }
};

const chatsByEmail = {
  cliente_alfa_rebistattoo_it: {
    chatId: 'chat_001'
  }
};

const rtdb = {
  adminUids: {
    Nhmp6AN2ehPksUbP4mlCskNirA83: true,
    adm_admin_02: true
  },
  users: toMap(users.map(u => {
    const { uid, ...rest } = u;
    return rest;
  })),
  staffProfiles,
  services,
  projects,
  bookings,
  sessions,
  reviews,
  notifications,
  conversations,
  messages,
  userConversations,
  chats,
  chatsByEmail
};

const firestoreUsers = {
  users: users.map(u => ({ ...u }))
};

const authTemplate = {
  users: users.map(u => ({
    uid: u.uid,
    email: u.email,
    role: u.role,
    password: '131099',
    disabled: false
  }))
};

const unified = {
  meta: {
    generatedAt: nowIso,
    note: 'Mock ricco: 10 utenti, livelli staff, progetti/booking/sessioni/reviews/servizi',
    userCount: users.length,
    projectCount: Object.keys(projects).length,
    bookingCount: Object.keys(bookings).length,
    sessionCount: Object.keys(sessions).length,
    reviewCount: Object.keys(reviews).length,
    demoPlaybook: {
      credentials: {
        adminOwner: {
          email: 'valhallawebapp@gmail.com',
          password: '131099'
        },
        staffOperator: {
          email: 'staff.test@rebistattoo.it',
          password: '131099'
        },
        clientDemo: {
          email: 'cliente.alfa@rebistattoo.it',
          password: '131099'
        }
      },
      scenarios: [
        {
          id: 'scenario_01_fast_booking',
          title: 'Fast Booking da cliente',
          actorUserId: 'cli_03',
          targetBookingId: 'bk_002',
          targetProjectId: 'prj_003'
        },
        {
          id: 'scenario_02_staff_booking',
          title: 'Creazione booking da staff operator',
          actorUserId: 'stf_test_01',
          targetBookingId: 'bk_003',
          targetProjectId: 'prj_004'
        },
        {
          id: 'scenario_03_chat_booking',
          title: 'Lead chat-bot convertito in booking',
          actorUserId: 'cli_01',
          targetBookingId: 'bk_004',
          targetProjectId: 'prj_005'
        },
        {
          id: 'scenario_04_admin_booking',
          title: 'Booking creato da admin',
          actorUserId: 'adm_admin_02',
          targetBookingId: 'bk_005',
          targetProjectId: 'prj_006'
        },
        {
          id: 'scenario_05_project_without_booking',
          title: 'Progetto con sessione ma senza booking',
          actorUserId: 'Nhmp6AN2ehPksUbP4mlCskNirA83',
          targetProjectId: 'prj_002',
          targetSessionIds: ['ses_004']
        }
      ]
    }
  },
  realtimeDbExport: rtdb,
  firestore: firestoreUsers,
  auth: authTemplate
};

function writeJson(filename, data) {
  const file = path.join(outDir, filename);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

writeJson('firebase-rtdb-export.mock.json', rtdb);
writeJson('firebase-rtdb-export.mock.safe.json', rtdb);
writeJson('firestore-users.mock.json', firestoreUsers);
writeJson('firebase-unified.mock.json', unified);
writeJson('mock-demo-playbook.json', unified.meta.demoPlaybook);

console.log('Dataset mock generato con successo.');
console.log(`Utenti: ${users.length}`);
console.log(`Progetti: ${Object.keys(projects).length}`);
console.log(`Booking: ${Object.keys(bookings).length}`);
console.log(`Sessioni: ${Object.keys(sessions).length}`);
console.log(`Recensioni: ${Object.keys(reviews).length}`);
