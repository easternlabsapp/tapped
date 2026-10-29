import Foundation

enum StatusError: Error, Equatable {
    case invalidZip
    case server          // non-200 from our API
    case network         // couldn't reach our API
    case badResponse     // unexpected payload
}

protocol StatusFetching {
    func status(forZip zip: String) async throws -> StatusResponse
}

/// The only network call in the app. Sends a 5-digit ZIP and nothing else.
struct APIStatusService: StatusFetching {
    var baseURL: URL = Config.apiBaseURL
    var session: URLSession = .shared

    func status(forZip zip: String) async throws -> StatusResponse {
        guard ZipCode.isValid(zip) else { throw StatusError.invalidZip }

        var components = URLComponents(url: baseURL.appendingPathComponent("status"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "zip", value: zip)]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 20

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw StatusError.network
        }

        guard let http = response as? HTTPURLResponse else { throw StatusError.badResponse }
        switch http.statusCode {
        case 200:
            do { return try JSONDecoder().decode(StatusResponse.self, from: data) }
            catch { throw StatusError.badResponse }
        case 400: throw StatusError.invalidZip
        default: throw StatusError.server
        }
    }
}
