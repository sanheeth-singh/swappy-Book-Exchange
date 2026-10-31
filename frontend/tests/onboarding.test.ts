import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialsSchema, profileSchema } from '../src/features/auth/schemas';
import { validateProof } from '../src/features/membership/validation';
test('forms reject invalid email and campus IDs before requests', () => {
 assert.equal(credentialsSchema.safeParse({ email: 'bad', password: '1234' }).success, false);
 assert.equal(profileSchema.safeParse({ display_name: 'Ben', campus_id: '' }).success, false);
});
test('proof validation rejects unsupported, empty and oversized uploads', () => {
 assert.ok(validateProof({ type: 'application/pdf', size: 40 }));
 assert.ok(validateProof({ type: 'image/png', size: 0 }));
 assert.ok(validateProof({ type: 'image/png', size: 6 * 1024 * 1024 }));
 assert.equal(validateProof({ type: 'image/jpeg', size: 5 * 1024 * 1024 }), undefined);
});
