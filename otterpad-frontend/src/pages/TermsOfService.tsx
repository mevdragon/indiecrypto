import { Layout } from "antd";
import AppLayout from "../AppLayout";

const TermsOfServicePage = () => {
  return (
    <AppLayout>
      <Layout
        style={{
          background: "#f5f5f5",
          padding: "16px 16px 16px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "left", maxWidth: "600px" }}>
          <h1>Terms of Service</h1>
          <div className="text-sm text-gray-600">
            Last Updated: November 19, 2024
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using IndieCrypto ("Platform") at
              https://indiecrypto.club, you agree to be bound by these Terms of
              Service ("Terms") and Privacy Policy. If you disagree with any
              part of these terms, we strongly advise you not to use the
              Platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Platform Description</h2>
            <p>
              IndieCrypto is a permissionless fundraising platform operating on
              Ethereum Virtual Machine (EVM) compatible blockchains. The
              Platform is provided as free, open-source software without any
              warranties or guarantees of any kind.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">
              3. Wallet Responsibility and Support Limitations
            </h2>
            <div className="space-y-2">
              <p>
                <strong>IMPORTANT:</strong> The IndieCrypto team cannot and will
                not assist with any wallet-related issues, including but not
                limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Lost or forgotten private keys</li>
                <li>Compromised wallets</li>
                <li>Incorrect transaction submissions</li>
                <li>Funds sent to wrong addresses</li>
                <li>Scam recovery</li>
                <li>Password resets</li>
                <li>Account recovery</li>
              </ul>
              <p className="font-semibold">
                Your cryptocurrency wallet and its security are entirely your
                responsibility. The IndieCrypto team has no ability to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your wallet</li>
                <li>Recover your funds</li>
                <li>Reverse transactions</li>
                <li>Reset passwords</li>
                <li>Provide refunds</li>
                <li>Mediate disputes</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">
              4. Blockchain Transparency and Project Liability
            </h2>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                4.1 Public Nature of Blockchain
              </h3>
              <p>You acknowledge that:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  All transactions conducted through the Platform are recorded
                  on public blockchains
                </li>
                <li>
                  Transaction details, wallet addresses, and interaction data
                  are publicly visible and permanently recorded
                </li>
                <li>
                  Any information submitted to the blockchain cannot be deleted
                  or modified
                </li>
              </ul>

              <h3 className="text-xl font-semibold">4.2 Project Liability</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Each project listed on IndieCrypto is solely responsible for
                  their own operations, claims, and obligations
                </li>
                <li>
                  Project teams bear full responsibility and liability for their
                  fundraising activities, promises, and deliverables
                </li>
                <li>
                  IndieCrypto does not endorse, guarantee, or assume any
                  responsibility for projects listed on the Platform
                </li>
                <li>
                  Users must conduct their own research and due diligence on
                  individual projects
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Disclaimers and Risks</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">5.1 General Disclaimers</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  The Platform is provided strictly on an "AS IS" and "AS
                  AVAILABLE" basis
                </li>
                <li>
                  We make no warranties of any kind, whether express, implied,
                  statutory, or otherwise
                </li>
                <li>
                  We explicitly disclaim any warranties of merchantability,
                  fitness for a particular purpose, non-infringement, and any
                  warranties arising out of course of dealing or usage of trade
                </li>
              </ul>

              <h3 className="text-xl font-semibold">5.2 Risk Acknowledgment</h3>
              <p>
                By using the Platform, you explicitly acknowledge and accept:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  All risks associated with cryptocurrency, smart contracts, and
                  blockchain technology
                </li>
                <li>Risk of loss of funds, tokens, or cryptocurrencies</li>
                <li>Risks related to volatile market conditions</li>
                <li>
                  Potential smart contract vulnerabilities or technical failures
                </li>
                <li>Risks of regulatory changes or enforcement actions</li>
                <li>
                  Possibility of scams, fraud, or malicious activities by third
                  parties
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Privacy Policy</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                6.1 Data Collection and Usage
              </h3>
              <p>We collect and process information through:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Third-party analytics services including but not limited to:
                  <ul className="list-disc pl-6">
                    <li>Google Analytics</li>
                    <li>SmartLook</li>
                    <li>Other analytical tools</li>
                  </ul>
                </li>
                <li>Cookies and similar tracking technologies</li>
                <li>Blockchain data that is publicly available</li>
              </ul>

              <h3 className="text-xl font-semibold">6.2 Cookies</h3>
              <p>Our Platform uses cookies to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain session information</li>
                <li>Provide custom experiences</li>
                <li>Track usage patterns</li>
                <li>Store user preferences</li>
              </ul>
              <p>
                You can modify your browser settings to decline cookies, but
                this may affect Platform functionality.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">7. Contact Information</h2>
            <p>For support inquiries: admin@indiecrypto.club</p>
            <p>Website: https://indiecrypto.club</p>
          </section>

          <section className="mt-8 p-4 bg-gray-100 rounded-lg">
            <p className="font-bold text-center">
              BY USING THE PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE
              TERMS OF SERVICE AND PRIVACY POLICY, UNDERSTAND THEM, AND AGREE TO
              BE BOUND BY THEM.
            </p>
          </section>
        </div>
      </Layout>
    </AppLayout>
  );
};

export default TermsOfServicePage;
