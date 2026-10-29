import CoreLocation

enum LocateError: Error, Equatable {
    case permissionDenied
    case locationUnavailable
    case geocodingFailed
    case notUS
}

protocol ZipLocating {
    /// Requests permission if needed, finds an approximate location, and
    /// reverse-geocodes it to a 5-digit US ZIP. Coordinates never leave this type.
    func currentZip() async throws -> String
}

@MainActor
final class CoreLocationZipLocator: NSObject, ZipLocating, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var authContinuation: CheckedContinuation<Void, Never>?
    private var locationContinuation: CheckedContinuation<CLLocation, Error>?

    override init() {
        super.init()
        manager.delegate = self
        // Coarse is plenty for a ZIP code (and better for privacy).
        manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
    }

    func currentZip() async throws -> String {
        try await ensureAuthorized()
        let location = try await requestLocation()
        return try await zip(for: location)
    }

    // MARK: Permission

    private func ensureAuthorized() async throws {
        if manager.authorizationStatus == .notDetermined {
            // Triggered by the user's tap; the system dialog shows our usage description.
            await withCheckedContinuation { continuation in
                authContinuation = continuation
                manager.requestWhenInUseAuthorization()
            }
        }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return
        default: throw LocateError.permissionDenied
        }
    }

    // MARK: Location

    private func requestLocation() async throws -> CLLocation {
        guard CLLocationManager.locationServicesEnabled() else { throw LocateError.locationUnavailable }
        return try await withCheckedThrowingContinuation { continuation in
            locationContinuation = continuation
            manager.requestLocation()
        }
    }

    // MARK: Reverse geocoding (Apple's geocoder; we never see the coordinates)

    private func zip(for location: CLLocation) async throws -> String {
        let placemarks: [CLPlacemark]
        do {
            placemarks = try await CLGeocoder().reverseGeocodeLocation(location)
        } catch {
            throw LocateError.geocodingFailed
        }
        guard let placemark = placemarks.first else { throw LocateError.geocodingFailed }
        guard placemark.isoCountryCode == "US" else { throw LocateError.notUS }
        let zip = String((placemark.postalCode ?? "").prefix(5))
        guard ZipCode.isValid(zip) else { throw LocateError.geocodingFailed }
        return zip
    }

    // MARK: CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined, let c = authContinuation else { return }
            authContinuation = nil
            c.resume()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            guard let c = locationContinuation else { return }
            locationContinuation = nil
            c.resume(returning: location)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            guard let c = locationContinuation else { return }
            locationContinuation = nil
            let denied = (error as? CLError)?.code == .denied
            c.resume(throwing: denied ? LocateError.permissionDenied : LocateError.locationUnavailable)
        }
    }
}
