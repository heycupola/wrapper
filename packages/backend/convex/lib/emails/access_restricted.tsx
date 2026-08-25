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
  button,
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
  warningBlock,
} from "./styles.ts";

interface AccessRestrictedEmailProps {
  userName?: string;
  ownedSessionCount?: number;
  sharedSessionCount?: number;
  upgradeUrl?: string;
}

export const AccessRestrictedEmail = ({
  userName = "there",
  ownedSessionCount = 0,
  sharedSessionCount = 0,
  upgradeUrl = `${siteUrl}/dashboard/billing`,
}: AccessRestrictedEmailProps) => {
  const totalCount = ownedSessionCount + sharedSessionCount;
  const hasSessions = totalCount > 0;

  return (
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
            <Text style={heading}>Remote access is no longer available</Text>
            <Text style={paragraph}>Hi {userName},</Text>
            <Text style={paragraph}>
              Your Wrapper account is on the Free plan, so remote attach is off.
              {hasSessions && " This currently affects:"}
            </Text>
            {hasSessions && (
              <Section style={warningBlock}>
                {ownedSessionCount > 0 && (
                  <Text style={listItem}>
                    {ownedSessionCount} hosted {ownedSessionCount === 1 ? "session" : "sessions"}
                  </Text>
                )}
                {sharedSessionCount > 0 && (
                  <Text
                    style={
                      sharedSessionCount > 0 && ownedSessionCount > 0 ? listItemLast : listItem
                    }
                  >
                    {sharedSessionCount} viewer {sharedSessionCount === 1 ? "ticket" : "tickets"}
                  </Text>
                )}
              </Section>
            )}
            <Text style={paragraph}>
              Upgrade to Pro to attach from another device again. Local attach on the same computer
              still works.
            </Text>
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
};

export default AccessRestrictedEmail;
