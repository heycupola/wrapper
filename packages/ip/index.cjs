"use strict";

const ipaddr = require("ipaddr.js");

function parse(address) {
  if (!ipaddr.isValid(address)) throw new Error(`Invalid IP address: ${address}`);
  return ipaddr.parse(address);
}

function isLoopback(address) {
  const parsed = parse(address);
  if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address().range() === "loopback";
  }
  return parsed.range() === "loopback";
}

function isV4Format(address) {
  return ipaddr.IPv4.isValid(address);
}

function isV6Format(address) {
  return ipaddr.IPv6.isValid(address);
}

function toBuffer(address, buffer, offset = 0) {
  const bytes = Buffer.from(parse(address).toByteArray());
  if (!buffer) return bytes;
  bytes.copy(buffer, offset);
  return buffer;
}

function toString(buffer, offset = 0, length) {
  const size = length ?? buffer.length - offset;
  const bytes = [...buffer.subarray(offset, offset + size)];
  if (bytes.length !== 4 && bytes.length !== 16) {
    throw new Error(`Invalid IP buffer length: ${bytes.length}`);
  }
  return ipaddr.fromByteArray(bytes).toString();
}

function isPrivate(address) {
  const parsed = parse(address);
  const normalized =
    parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress() ? parsed.toIPv4Address() : parsed;
  return new Set([
    "private",
    "loopback",
    "linkLocal",
    "uniqueLocal",
    "unspecified",
    "carrierGradeNat",
  ]).has(normalized.range());
}

function isPublic(address) {
  return !isPrivate(address);
}

module.exports = {
  isLoopback,
  isPrivate,
  isPublic,
  isV4Format,
  isV6Format,
  toBuffer,
  toString,
};
