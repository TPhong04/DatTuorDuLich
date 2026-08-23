import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'

import { ToastProvider } from '@/components/notifications/ToastProvider'
import AdminShell from '@/layouts/admin/AdminShell'
import AppShell from '@/layouts/AppShell'
import StaffShell from '@/layouts/staff/StaffShell'
import RequireAuth from '@/routes/RequireAuth'
import RequireRole from '@/routes/RequireRole'
import { BookingPageShell } from '@/pages/BookingPage'

import AccountBookingsPage from '@/pages/AccountBookingsPage'
import AccountEditPage from '@/pages/AccountEditPage'
import AccountNotificationsPage from '@/pages/AccountNotificationsPage'
import AccountPage from '@/pages/AccountPage'
import AdminDashboardPage from '@/pages/AdminDashboardPage'
import BookingPage from '@/pages/BookingPage'
import CancelPolicyPage from '@/pages/CancelPolicyPage'
import ContactPage from '@/pages/ContactPage'
import GroupTourPage from '@/pages/GroupTourPage'
import GroupTourRequestPage from '@/pages/GroupTourRequestPage'
import HomePage from '@/pages/HomePage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import LoginPage from '@/pages/LoginPage'
import NewsDetailPage from '@/pages/NewsDetailPage'
import NewsPage from '@/pages/NewsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RegisterPage from '@/pages/RegisterPage'
import RentalsPage from '@/pages/RentalsPage'
import ServiceDetailPage from '@/pages/ServiceDetailPage'
import ServicesPage from '@/pages/ServicesPage'
import StaffDashboardPage from '@/pages/StaffDashboardPage'
import TermsPage from '@/pages/TermsPage'
import TourDetailPage from '@/pages/TourDetailPage'
import ToursPage from '@/pages/ToursPage'
import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage'
import AdminBookingsPage from '@/pages/admin/AdminBookingsPage'
import AdminCatalogPage from '@/pages/admin/AdminCatalogPage'
import AdminContentBannersPage from '@/pages/admin/AdminContentBannersPage'
import AdminContentPostsPage from '@/pages/admin/AdminContentPostsPage'
import AdminContentReviewsPage from '@/pages/admin/AdminContentReviewsPage'
import AdminDeparturesPage from '@/pages/admin/AdminDeparturesPage'
import AdminGroupTourRequestsPage from '@/pages/admin/AdminGroupTourRequestsPage'
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage'
import AdminReportsPage from '@/pages/admin/AdminReportsPage'
import AdminTourEditorPage from '@/pages/admin/AdminTourEditorPage'
import AdminToursPage from '@/pages/admin/AdminToursPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminVehiclesPage from '@/pages/admin/AdminVehiclesPage'
import AdminRentalsPage from '@/pages/admin/AdminRentalsPage'
import AdminSettingsLayout from '@/pages/admin/settings/AdminSettingsLayout'
import AdminSettingsIndexPage from '@/pages/admin/settings/AdminSettingsIndexPage'
import AdminSettingsCompanyPage from '@/pages/admin/settings/AdminSettingsCompanyPage'
import AdminSettingsBrandingPage from '@/pages/admin/settings/AdminSettingsBrandingPage'
import AdminSettingsHomePage from '@/pages/admin/settings/AdminSettingsHomePage'
import AdminSettingsBookingPage from '@/pages/admin/settings/AdminSettingsBookingPage'
import AdminSettingsPaymentPage from '@/pages/admin/settings/AdminSettingsPaymentPage'
import AdminSettingsNotificationsPage from '@/pages/admin/settings/AdminSettingsNotificationsPage'
import AdminSettingsSecurityPage from '@/pages/admin/settings/AdminSettingsSecurityPage'
import AdminSettingsIntegrationsPage from '@/pages/admin/settings/AdminSettingsIntegrationsPage'
import AdminSettingsMasterDataPage from '@/pages/admin/settings/AdminSettingsMasterDataPage'
import StaffBookingsPage from '@/pages/staff/StaffBookingsPage'
import StaffContentReviewsPage from '@/pages/staff/StaffContentReviewsPage'
import StaffDeparturesPage from '@/pages/staff/StaffDeparturesPage'
import StaffGroupTourRequestsPage from '@/pages/staff/StaffGroupTourRequestsPage'
import StaffNotificationsPage from '@/pages/staff/StaffNotificationsPage'
import StaffToursPage from '@/pages/staff/StaffToursPage'
import StaffVehiclesPage from '@/pages/staff/StaffVehiclesPage'
import StaffRentalsPage from '@/pages/staff/StaffRentalsPage'
import AdminChatListPage from '@/pages/admin/AdminChatListPage'
import AdminChatDetailPage from '@/pages/admin/AdminChatDetailPage'

function BookingPublicRoute() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <BookingPageShell slug={slug ?? null}>
      <BookingPage />
    </BookingPageShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />

            <Route path="/tours" element={<ToursPage />} />
            <Route path="/tours/:slug" element={<TourDetailPage />} />

            <Route path="/group-tour" element={<GroupTourPage />} />

            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:serviceSlug" element={<ServiceDetailPage />} />

            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsDetailPage />} />

            <Route path="/contact" element={<ContactPage />} />
            <Route path="/cho-thue-xe" element={<RentalsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/policy/cancel" element={<CancelPolicyPage />} />

            <Route path="/dat-tour/:slug" element={<BookingPublicRoute />} />

            <Route element={<RequireAuth />}>
              <Route path="/group-tour/request" element={<GroupTourRequestPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/edit" element={<AccountEditPage />} />
              <Route path="/account/bookings" element={<AccountBookingsPage />} />
              <Route path="/account/notifications" element={<AccountNotificationsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Auth routes: trang riêng, không dùng AppShell (không header/footer) */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<RequireRole role="staff" />}>
            <Route element={<StaffShell />} path="/staff">
              <Route index element={<StaffDashboardPage />} />
              <Route path="notifications" element={<StaffNotificationsPage />} />
              <Route path="bookings" element={<StaffBookingsPage />} />
              <Route path="tours" element={<StaffToursPage />} />
              <Route path="departures" element={<StaffDeparturesPage />} />
              <Route path="vehicles" element={<StaffVehiclesPage />} />
              <Route path="rentals" element={<StaffRentalsPage />} />
              <Route path="group-tour-requests" element={<StaffGroupTourRequestsPage />} />
              <Route path="content/posts" element={<AdminContentPostsPage />} />
              <Route path="content/reviews" element={<StaffContentReviewsPage />} />
              <Route path="inbox" element={<AdminChatListPage />} />
              <Route path="inbox/:id" element={<AdminChatDetailPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="admin" />}>
            <Route element={<AdminShell />} path="/admin">
              <Route index element={<AdminDashboardPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="tours" element={<AdminToursPage />} />
              <Route path="tours/new" element={<AdminTourEditorPage />} />
              <Route path="tours/:id/edit" element={<AdminTourEditorPage />} />
              <Route path="departures" element={<AdminDeparturesPage />} />
              <Route path="catalog" element={<AdminCatalogPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="vehicles" element={<AdminVehiclesPage />} />
              <Route path="rentals" element={<AdminRentalsPage />} />
              <Route path="group-tour-requests" element={<AdminGroupTourRequestsPage />} />
              <Route path="content/posts" element={<AdminContentPostsPage />} />
              <Route path="content/reviews" element={<AdminContentReviewsPage />} />
              <Route path="content/banners" element={<AdminContentBannersPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="customer-chat" element={<AdminChatListPage />} />
              <Route path="customer-chat/:id" element={<AdminChatDetailPage />} />
              <Route path="settings" element={<AdminSettingsLayout />}>
                <Route index element={<AdminSettingsIndexPage />} />
                <Route path="company" element={<AdminSettingsCompanyPage />} />
                <Route path="branding" element={<AdminSettingsBrandingPage />} />
                <Route path="home" element={<AdminSettingsHomePage />} />
                <Route path="booking" element={<AdminSettingsBookingPage />} />
                <Route path="payment" element={<AdminSettingsPaymentPage />} />
                <Route path="notifications" element={<AdminSettingsNotificationsPage />} />
                <Route path="security" element={<AdminSettingsSecurityPage />} />
                <Route path="integrations" element={<AdminSettingsIntegrationsPage />} />
                <Route path="master-data" element={<AdminSettingsMasterDataPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
