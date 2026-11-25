import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-medical-blue">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">The page you are looking for does not exist or has moved.</p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg bg-medical-blue px-4 py-2 text-sm font-medium text-white hover:bg-medical-blue-dark"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}