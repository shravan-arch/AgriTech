import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isConfigured, sendPasswordResetEmail, sendVerificationEmail, setCustomTransporter } from '../src/services/emailService.js';
import User from '../src/models/User.js';

describe('Production Reliability and Hardening Suite', () => {
  describe('Email Service Timeout and Failure Handling', () => {
    test('isConfigured reports false when SMTP_HOST is not set or empty', () => {
      const originalHost = process.env.SMTP_HOST;
      try {
        delete process.env.SMTP_HOST;
        setCustomTransporter(null);
        assert.equal(isConfigured(), false);
      } finally {
        if (originalHost) process.env.SMTP_HOST = originalHost;
      }
    });

    test('isConfigured reports true when SMTP_HOST is provided', () => {
      const originalHost = process.env.SMTP_HOST;
      try {
        process.env.SMTP_HOST = 'smtp.sendgrid.net';
        setCustomTransporter(null);
        assert.equal(isConfigured(), true);
      } finally {
        if (originalHost) process.env.SMTP_HOST = originalHost;
        else delete process.env.SMTP_HOST;
      }
    });

    test('sendPasswordResetEmail rejects with EMAIL_NOT_CONFIGURED if transporter is unavailable', async () => {
      const originalHost = process.env.SMTP_HOST;
      try {
        delete process.env.SMTP_HOST;
        setCustomTransporter(null);
        await assert.rejects(
          async () => {
            await sendPasswordResetEmail({
              to: 'farmer@punjab.farm',
              name: 'Gurpreet Singh',
              resetToken: 'token-123456',
            });
          },
          (err) => {
            assert.equal(err.code, 'EMAIL_NOT_CONFIGURED');
            return true;
          }
        );
      } finally {
        if (originalHost) process.env.SMTP_HOST = originalHost;
      }
    });

    test('sendPasswordResetEmail accepts polymorphic parameter signatures without error', async () => {
      const sent = [];
      setCustomTransporter({
        async sendMail(opts) {
          sent.push(opts);
          return { messageId: 'msg-123' };
        },
      });

      try {
        // Object form
        await sendPasswordResetEmail({
          to: 'farmer1@punjab.farm',
          name: 'Farmer One',
          resetToken: 'token-abc',
        });
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, 'farmer1@punjab.farm');
        assert.match(sent[0].html, /token-abc/);

        // Positional string form (used in adminController)
        await sendPasswordResetEmail('farmer2@punjab.farm', 'token-def');
        assert.equal(sent.length, 2);
        assert.equal(sent[1].to, 'farmer2@punjab.farm');
        assert.match(sent[1].html, /token-def/);
      } finally {
        setCustomTransporter(null);
      }
    });

    test('sendPasswordResetEmail times out cleanly and throws if SMTP hangs', async () => {
      // Mock a hanging transporter that never resolves
      setCustomTransporter({
        sendMail() {
          return new Promise(() => {
            // Intentionally never resolve or reject
          });
        },
      });

      try {
        const start = Date.now();
        await assert.rejects(
          async () => {
            // Should be bounded by the timeout wrapper
            await sendPasswordResetEmail({
              to: 'slow@punjab.farm',
              name: 'Slow SMTP Farmer',
              resetToken: 'token-slow',
            });
          },
          (err) => {
            assert.match(err.message, /timed out/i);
            return true;
          }
        );
        const elapsed = Date.now() - start;
        assert.ok(elapsed >= 9500 && elapsed <= 12000, `Elapsed time ${elapsed}ms should be around 10000ms`);
      } finally {
        setCustomTransporter(null);
      }
    });
  });

  describe('User Schema Validation and Modern Domain Support', () => {
    test('User schema accepts modern agricultural and tech TLDs (.farm, .online, .tech)', () => {
      const validEmails = [
        'farmer@greenacres.farm',
        'ops@krishi.online',
        'support@agritech.tech',
        'info@punjab.co.in',
        'standard@example.com',
      ];

      for (const email of validEmails) {
        const user = new User({
          name: 'Test Farmer',
          email,
          password: 'Password12345!',
        });
        const err = user.validateSync();
        assert.equal(err?.errors?.email, undefined, `Email ${email} should be valid`);
      }
    });

    test('User schema rejects invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@missinguser.com',
        'missingdomain@.com',
        'missing-tld@domain',
      ];

      for (const email of invalidEmails) {
        const user = new User({
          name: 'Test Farmer',
          email,
          password: 'Password12345!',
        });
        const err = user.validateSync();
        assert.ok(err?.errors?.email, `Email ${email} should be invalid`);
      }
    });
  });
});
