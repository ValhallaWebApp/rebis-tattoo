// import { Booking } from '../models/booking.model';
// import { Client } from '../models/client.model';
// import { AppUser } from '../models/user.model';
// import { Invoice } from '../models/invoice.model';
// import { TattooService } from '../models/service.model';
// import { Project } from '../models/project.model';

// export const fromFirestore = {
//   booking: (data: any, id: string): Booking => ({
//     id,
//     clientId: data.clientId,
//     staffId: data.staffId,
//     serviceId: data.serviceId,
//     projectId: data.projectId,
//     start: data.start,
//     duration: data.duration,
//     status: data.status,
//     type: data.type || 'tattoo',
//     notes: data.notes,
//     createdAt: data.createdAt,
//     updatedAt: data.updatedAt
//   }),

//   client: (data: any, id: string): Client => ({
//     id,
//     displayName: data.displayName,
//     email: data.email,
//     phone: data.phone,
//     instagram: data.instagram,
//     createdAt: data.createdAt,
//     referredBy: data.referredBy
//   }),

//   user: (data: any, id: string): AppUser => ({
//     id,
//     email: data.email,
//     displayName: data.displayName,
//     role: data.role,
//     photoURL: data.photoURL,
//     phoneNumber: data.phoneNumber,
//     createdAt: data.createdAt
//   }),

//   invoice: (data: any, id: string): Invoice => ({
//     id,
//     clientId: data.clientId,
//     bookingId: data.bookingId,
//     amount: data.amount,
//     currency: data.currency,
//     status: data.status,
//     issuedAt: data.issuedAt,
//     paidAt: data.paidAt,
//     stripePaymentIntentId: data.stripePaymentIntentId
//   }),

//   service: (data: any, id: string): TattooService => ({
//     id,
//     title: data.title,
//     description: data.description,
//     price: data.price,
//     duration: data.duration,
//     isVisible: data.isVisible
//   }),

//   project: (data: any, id: string): Project => ({
//     id,
//     title: data.title,
//     description: data.description,
//     clientId: data.clientId,
//     artistIds: data.artistIds,
//     imageUrls: data.imageUrls,
//     createdAt: data.createdAt
//   })
// };
