import Foundation

enum Config {
    /// Our own API. The app talks to nothing else.
    static let apiBaseURL: URL = {
        #if DEBUG
        return URL(string: "http://localhost:8787")!   // `npm run dev` in backend/
        #else
        return URL(string: "https://tapped-api.tapped-api.workers.dev")!
        #endif
    }()
}
