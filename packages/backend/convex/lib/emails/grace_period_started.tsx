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
  cautionBlock,
  cautionText,
  container,
  cupolaLogo,
  divider,
  footer,
  footerText,
  heading,
  listItem,
  listItemLast,
  logoImg,
  main,
  paragraph,
  section,
  siteUrl,
  subheading,
} from "./styles.ts";

interface GracePeriodStartedEmailProps {
  userName?: string;
  daysRemaining?: number;
  upgradeUrl?: string;
}

export const GracePeriodStartedEmail = ({
  userName = "there",
  daysRemaining: _daysRemaining = 7,
  upgradeUrl = `${siteUrl}/dashboard/billing`,
}: GracePeriodStartedEmailProps) => (
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
          <Text style={heading}>Your plan has changed</Text>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            You&apos;ve been moved to the Free plan. Remote attach and relay sharing are Pro
            features, so they are off now.
          </Text>
          <Section style={cautionBlock}>
            <Text style={cautionText}>
              Local attach on the same computer still works. Upgrade to Pro to restore remote
              access.
            </Text>
          </Section>
          <Text style={subheading}>Your options</Text>
          <Section style={block}>
            <Text style={listItem}>Upgrade to Pro to attach from another device again</Text>
            <Text style={listItemLast}>Keep using Wrapper locally on this machine</Text>
          </Section>
          <Button style={button} href={upgradeUrl}>
            Upgrade to Pro
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

export default GracePeriodStartedEmail;
