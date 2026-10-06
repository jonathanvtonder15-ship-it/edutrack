import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from '../lib/html'

test('print data cannot become markup or break out of quoted attributes', () => {
  assert.equal(escapeHtml('</td><script>alert("x")</script>'), '&lt;/td&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  assert.equal(escapeHtml('photo" onerror="alert(1)\'&'), 'photo&quot; onerror=&quot;alert(1)&#39;&amp;')
  assert.equal(escapeHtml("O'Brien & Sons <Grade 8>"), 'O&#39;Brien &amp; Sons &lt;Grade 8&gt;')
  assert.equal(escapeHtml(0), '0')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})
