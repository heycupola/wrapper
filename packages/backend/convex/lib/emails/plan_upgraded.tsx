import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Section,
  Text,
} from "@react-email/components";
import {
  block,
  button,
  container,
  cupolaLogo,
  divider,
  footer,
  footerText,
  heading,
  infoBlock,
  infoText,
  listItem,
  listItemLast,
  logoImg,
  main,
  paragraph,
  section,
  siteUrl,
  subheading,
} from "./styles.ts";

interface PlanUpgradedEmailProps {
  userName?: string;
  dashboardUrl?: string;
}

export const PlanUpgradedEmail = ({
  userName = "there",
  dashboardUrl = `${siteUrl}/dashboard`,
}: PlanUpgradedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={section}>
          <Img
            src={`${siteUrl}/wrapper-icon-dark.svg`}
            alt="Wrapper"
            width="40"
            height="40"
            style={logoImg}
          />
          <Hr style={divider} />
          <Text style={heading}>Welcome to Pro</Text>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>You&apos;re now on Wrapper Pro. Remote attach is unlocked.</Text>
          <Text style={subheading}>What&apos;s included</Text>
          <Section style={block}>
            <Text style={listItem}>Attach from another device</Text>
            <Text style={listItem}>Direct WebRTC when available</Text>
            <Text style={listItem}>Authenticated relay fallback</Text>
            <Text style={listItemLast}>Everything included in Free</Text>
          </Section>
          <Section style={infoBlock}>
            <Text style={infoText}>
              Local is still free. Remote is Pro. Your terminal stays on your machine until you
              share it.
            </Text>
          </Section>
          <Button style={button} href={dashboardUrl}>
            Go to Dashboard
          </Button>
        </Section>
        <Section style={footer}>
          <Img
            src={`${siteUrl}/cupola-dark.svg`}
            alt="Cupola"
            width="80"
            height="16"
            style={cupolaLogo}
          />
          <Text style={footerText}>
            Built by Cupola Labs, LLC &middot; &copy; {new Date().getFullYear()}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default PlanUpgradedEmail;
