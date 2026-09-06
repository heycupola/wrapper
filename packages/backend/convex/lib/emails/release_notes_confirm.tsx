import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import {
  button,
  container,
  cupolaLogo,
  divider,
  footer,
  footerText,
  heading,
  logoImg,
  main,
  paragraph,
  section,
  siteUrl,
} from "./styles.ts";

interface ReleaseNotesConfirmEmailProps {
  confirmUrl?: string;
  unsubscribeUrl?: string;
}

const linkStyle = {
  color: "#62666E",
  textDecoration: "underline",
};

const afterButton = { ...paragraph, marginTop: "24px" };

export const ReleaseNotesConfirmEmail = ({
  confirmUrl = `${siteUrl}/release-notes/confirm`,
  unsubscribeUrl = `${siteUrl}/release-notes/unsubscribe`,
}: ReleaseNotesConfirmEmailProps) => (
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
          <Text style={heading}>Confirm this address</Text>
          <Text style={paragraph}>
            Someone, probably you, asked for Wrapper release notes at this address. Nothing arrives
            until you confirm.
          </Text>
          <Button style={button} href={confirmUrl}>
            Confirm and get release notes
          </Button>
          <Text style={afterButton}>
            One email per release. Every one carries a one-click unsubscribe link. The link above
            works for 48 hours.
          </Text>
          <Text style={paragraph}>
            If you did not ask for this, ignore the email. You can also{" "}
            <Link href={unsubscribeUrl} style={linkStyle}>
              remove the address
            </Link>{" "}
            now.
          </Text>
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

export default ReleaseNotesConfirmEmail;
