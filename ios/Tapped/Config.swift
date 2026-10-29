import Foundation

enum Config {
    /// Published privacy policy, linked from the About screen and App Store Connect.
    static let privacyPolicyURL = URL(string: "https://easternlabs.app/tapped/privacy")!

    /// Our own API. The app talks to nothing else.
    static let apiBaseURL: URL = {
        #if DEBUG
        return URL(string: "http://localhost:8787")!   // `npm run dev` in backend/
        #else
        return URL(string: "https://tapped-api.tapped-api.workers.dev")!
        #endif
    }()
}
