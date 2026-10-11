import { Router } from 'express';
import { getSupabaseClient } from '../lib/skills/db';
import { getProvider } from '../lib/providers';
import { encrypt } from '../lib/crypto/keyVault';

const router = Router();

router.post('/:provider/credentials', async (req, res) => {
  const { provider: providerId } = req.params;
  const { key, label } = req.body;
  const provider = getProvider(providerId);
  if (!provider) return res.status(404).send('Provider not found');

  const isValid = await provider.validateKey(key);
  if (!isValid) return res.status(401).send('Invalid key');

  const { ciphertext, iv, tag } = encrypt(key);
  const { data: { user } } = await getSupabaseClient().auth.getUser(req.headers.authorization!.split(' ')[1]);
  
  await getSupabaseClient()
    .from('provider_credentials')
    .upsert({
      user_id: user!.id,
      provider: providerId,
      key_ciphertext: ciphertext,
      key_iv: iv,
      key_tag: tag,
      key_last4: key.slice(-4),
      status: 'active'
    });

  res.send('Credentials saved');
});

export default router;
