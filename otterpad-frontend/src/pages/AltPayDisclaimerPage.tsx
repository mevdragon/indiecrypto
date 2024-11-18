import { Layout } from "antd";
import AppLayout from "../AppLayout";

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "24px",
  },
  shortForm: {
    backgroundColor: "#f8f9fa",
    border: "1px solid #dee2e6",
    borderRadius: "8px",
    padding: "24px",
    marginBottom: "32px",
  },
  alert: {
    backgroundColor: "#fff",
    borderLeft: "4px solid #0d6efd",
    padding: "16px",
    borderRadius: "4px",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #dee2e6",
    margin: "32px 0",
  },
  fullForm: {
    backgroundColor: "#fff",
    border: "1px solid #dee2e6",
    borderRadius: "8px",
    padding: "24px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "12px",
  },
  paragraph: {
    lineHeight: "1.6",
    color: "#212529",
    marginBottom: "16px",
  },
  warningAlert: {
    backgroundColor: "#fff3cd",
    borderLeft: "4px solid #ffc107",
    padding: "16px",
    borderRadius: "4px",
    marginTop: "24px",
  },
};

const AltPayDisclaimerPage = () => {
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
          <div style={styles.container}>
            <h1 style={styles.title}>Alternative Payment Methods Disclaimer</h1>

            {/* Short Form */}
            <div style={styles.shortForm}>
              <div style={styles.alert}>
                <p style={{ ...styles.paragraph, marginBottom: 0 }}>
                  IndieCrypto's Alternative Payment methods either accept ERC20
                  tokens directly to founding teams EVM wallet or to{" "}
                  <a
                    href="https://github.com/mevdragon/indiecrypto/blob/main/README.md"
                    target="_blank"
                  >
                    PreSaleLock contracts
                  </a>{" "}
                  which only accept ERC20 payments on only the same blockchain.
                  While your transaction history proves your entitlement, these
                  payments require manual processing by the founding team. This
                  introduces timing risks and price fluctuation exposure. A 2%
                  fee applies to all alternative payments.
                </p>
              </div>
            </div>

            {/* Divider */}
            <hr style={styles.divider} />

            {/* Full Version */}
            <div style={styles.fullForm}>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>PreSaleLock Smart Contracts</h2>
                <p style={styles.paragraph}>
                  IndieCrypto is a permissionless free open source software
                  operating on ethereum virtual machine (EVM) blockchains. The
                  PreSaleLock smart contracts are designed to accept ERC20
                  payments across EVM-compatible chains where public keys remain
                  consistent due to shared elliptical curve mathematics with ETH
                  Mainnet.
                </p>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Payment Process</h2>
                <p style={styles.paragraph}>
                  To participate, transfer ERC20 tokens directly to the contract
                  address. While your onchain transaction history will track
                  your entitlement to the fundraiser allocation, this does not
                  constitute a guarantee. Alternative payment methods require
                  the founding team's intervention to transfer your funds into
                  the Fundraiser smart contract by purchasing on your behalf.
                  Your tokens will be delivered to the same address used for
                  sending the ERC20 tokens.
                </p>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Risks and Timing</h2>
                <p style={styles.paragraph}>
                  The process requires manual bridging and transfer of funds by
                  project founders, which may take an indefinite period. During
                  this time, fundraiser prices may fluctuate. By utilizing this
                  alternative payment method, you explicitly accept both the
                  timing risks and reliance on the founding team's manual
                  intervention.
                </p>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Fees</h2>
                <p style={styles.paragraph}>
                  A 2% fee is applied to all funds sent to the PreSaleLock smart
                  contracts. For example, if you send $100 USDT, only $98 USDT
                  will be allocated towards purchasing the fundraiser token.
                </p>
              </section>

              <div style={styles.warningAlert}>
                <p style={{ ...styles.paragraph, marginBottom: 0 }}>
                  By proceeding with alternative payments, you acknowledge
                  understanding and accepting all associated risks, including
                  potential delays, price fluctuations, and reliance on manual
                  processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </AppLayout>
  );
};

export default AltPayDisclaimerPage;
