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
  bold,
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

interface CollaboratorAddedEmailProps {
  userName?: string;
  projectName?: string;
  ownerName?: string;
  dashboardUrl?: string;
}

export const CollaboratorAddedEmail = ({
  userName = "there",
  projectName = "a session",
  ownerName = "someone",
  dashboardUrl = `${siteUrl}/dashboard`,
}: CollaboratorAddedEmailProps) => (
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
          <Text style={heading}>You&apos;ve been given access to a session</Text>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            <strong style={bold}>{ownerName}</strong> shared{" "}
            <strong style={bold}>{projectName}</strong> with you.
          </Text>
          <Text style={paragraph}>
            Use the session id and share code they sent. Treat the code as a secret. Every accepted
            viewer can read output and send input.
          </Text>
          <Text style={subheading}>What you can do</Text>
          <Section style={block}>
            <Text style={listItem}>Attach from another device</Text>
            <Text style={listItem}>Read live terminal output</Text>
            <Text style={listItemLast}>Send input while the host keeps the session shared</Text>
          </Section>
          <Section style={infoBlock}>
            <Text style={infoText}>
              Access lasts until the host unshares or the session closes. Unsharing revokes unused
              viewer tickets.
            </Text>
          </Section>
          <Button style={button} href={dashboardUrl}>
            Open Dashboard
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

export default CollaboratorAddedEmail;
