import Foundation
import Observation

@MainActor
@Observable
final class LookupViewModel {
    enum Phase: Equatable {
        case idle
        case locating
        case loading
        case result(StatusResponse)
        case permissionDenied
        case locationUnavailable
        case notCovered
        case error(String)
    }

    private(set) var phase: Phase = .idle
    private(set) var placeName: String?
    /// The ZIP code the current result is for.
    private(set) var resultZip: String?
    var zipInput = ""

    private let locator: ZipLocating
    private let service: StatusFetching
    private let places: PlaceResolving
    private var generation = 0   // ignore results from superseded lookups

    init(locator: ZipLocating, service: StatusFetching, places: PlaceResolving) {
        self.locator = locator
        self.service = service
        self.places = places
    }

    var isBusy: Bool { phase == .locating || phase == .loading }

    func locate() async {
        guard !isBusy else { return }
        generation += 1
        let mine = generation
        phase = .locating
        placeName = nil
        do {
            let zip = try await locator.currentZip()
            guard mine == generation else { return }
            zipInput = zip   // show which ZIP we resolved
            await fetch(zip: zip, generation: mine)
        } catch let error as LocateError {
            guard mine == generation else { return }
            switch error {
            case .permissionDenied: phase = .permissionDenied
            case .notUS: phase = .notCovered
            case .locationUnavailable, .geocodingFailed: phase = .locationUnavailable
            }
        } catch {
            guard mine == generation else { return }
            phase = .locationUnavailable
        }
    }

    func lookUpTypedZip() async {
        guard !isBusy else { return }
        let zip = zipInput.trimmingCharacters(in: .whitespaces)
        guard ZipCode.isValid(zip) else {
            phase = .error("Enter a 5-digit US ZIP code.")
            return
        }
        generation += 1
        await fetch(zip: zip, generation: generation)
    }

    private func fetch(zip: String, generation mine: Int) async {
        phase = .loading
        placeName = nil
        // Look up the place name alongside the status; it's display-only and may be nil.
        async let place = places.placeName(forZip: zip)
        do {
            let response = try await service.status(forZip: zip)
            let name = await place
            guard mine == generation else { return }
            placeName = name
            resultZip = zip
            phase = .result(response)
        } catch StatusError.invalidZip {
            guard mine == generation else { return }
            phase = .error("That doesn't look like a valid US ZIP code.")
        } catch is CancellationError {
            return
        } catch {
            guard mine == generation else { return }
            phase = .error("Couldn't load water data. Check your connection and try again.")
        }
    }
}
