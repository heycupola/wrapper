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
  code,
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

interface WelcomeEmailProps {
  userName?: string;
  dashboardUrl?: string;
}

export const WelcomeEmail = ({
  userName = "there",
  dashboardUrl = `${siteUrl}/dashboard`,
}: WelcomeEmailProps) => (
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
          <Text style={heading}>Welcome to Wrapper</Text>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            Thanks for signing up. Your terminal stays on your machine until you share it. Nothing
            leaves until you say so.
          </Text>
          <Text style={subheading}>Get started</Text>
          <Section style={block}>
            <Text style={listItem}>Install the CLI</Text>
            <Text style={listItem}>
              Run <span style={code}>wrapper auth login</span>
            </Text>
            <Text style={listItem}>
              Start a host with <span style={code}>wrapper shell-host</span>
            </Text>
            <Text style={listItemLast}>Share only when you want a remote viewer</Text>
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

export default WelcomeEmail;
