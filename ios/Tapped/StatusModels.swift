import Foundation

enum WaterStatus: String, Decodable {
    case green, yellow, red, unknown

    // Tolerate status values added by a future backend.
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = WaterStatus(rawValue: raw) ?? .unknown
    }
}

struct WaterSystem: Decodable, Equatable {
    let pwsid: String
    let name: String
    let populationServed: Int
    let status: WaterStatus
    let sourceUrl: String?     // this system's page at the data source
}

/// Mirrors the backend contract for GET /status?zip=XXXXX.
struct StatusResponse: Decodable, Equatable {
    let status: WaterStatus
    let summary: String
    let systems: [WaterSystem]
    let dataAsOf: String
    let multipleSystems: Bool
    let source: String
    let note: String?          // set when we fell back to a nearby ZIP
    let disclaimer: String?
}

enum ZipCode {
    /// Strict 5-digit US ZIP, matching the backend's validation.
    static func isValid(_ s: String) -> Bool {
        s.count == 5 && s.allSatisfy { $0.isASCII && $0.isNumber } && s != "00000"
    }
}
