import { Body, Container, Head, Hr, Html, Img, Section, Text } from "@react-email/components";
import {
  block,
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
} from "./styles.ts";

interface AccountDeletedEmailProps {
  userName?: string;
  sessionsDeleted?: number;
  ticketsRevoked?: number;
}

export const AccountDeletedEmail = ({
  userName = "there",
  sessionsDeleted = 0,
  ticketsRevoked = 0,
}: AccountDeletedEmailProps) => (
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
          <Text style={heading}>Your account has been deleted</Text>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            Your Wrapper account and associated data have been permanently deleted as requested.
          </Text>
          {(sessionsDeleted > 0 || ticketsRevoked > 0) && (
            <Section style={block}>
              {sessionsDeleted > 0 && (
                <Text style={listItem}>
                  {sessionsDeleted} {sessionsDeleted === 1 ? "session" : "sessions"} deleted
                </Text>
              )}
              {ticketsRevoked > 0 && (
                <Text style={ticketsRevoked > 0 && sessionsDeleted > 0 ? listItemLast : listItem}>
                  {ticketsRevoked} {ticketsRevoked === 1 ? "ticket" : "tickets"} revoked
                </Text>
              )}
            </Section>
          )}
          <Section style={infoBlock}>
            <Text style={infoText}>
              This action is irreversible. Session metadata, share-code hashes, relay tickets, and
              account records have been removed from our systems. If you had an active subscription,
              billing customer deletion is queued.
            </Text>
          </Section>
          <Text style={paragraph}>
            Thank you for using Wrapper. If you ever want to come back, you can create a new account
            at any time.
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

export default AccountDeletedEmail;
