# Warning

## Orphaned Tokens Investor Protection

The fundraiser has a risk of leaving 1%-30% orphaned SALE tokens (your token for sale) stuck in the contract forever. This is a feature not a bug. It is meant to protect all investors from refund rugs.

Imagine these two scenerios:

- Scenerio #1:
  Raise 100k USDT with start price $1 end price $3
  Purchase#0 - Buyer1 buys 10k USDT, recieves 8,562.873 SALE (avg price 1.1678)
  Purchase#1 - Buyer2 buys 10k USDT, receives 6,806.975 SALE (avg price 1.4691)
  Refund#0 - Buyer1 refunds 10k USDT
  Purchase#2 - Buyer3 buys 10k USDT, receives 6,806.975 SALE (avg price 1.4691)

- Scenerio #2:
  Similar, Raise 100k USDT with start price $1 end price $3
  Purchase#0 - Buyer1 buys 20k USDT, recieves 15,369.848 SALE (avg price 1.3012)
  Purchase#1 - Buyer2 buys 10k USDT, receives 5,825.223 SALE (avg price 1.7167)
  Refund#0 - Buyer1 refunds 20k USDT
  Purchase#2 - Buyer3 buys 10k USDT, receives 6,806.975 SALE (avg price 1.4691)

When there are refunds, it decreases the price of tokens on the bonding curve. That means the next buyer could theortically get a lower price than an earlier investor. This is because when the earlier investor bought, they agreed to the exact terms at that point in time (X PAY tokens for Y SALE tokens). Their allocation of Y SALE tokens are locked in. You might feel like those earlier investors should get adjusted additional Y SALE tokens received due to earlier refunds, but this ends up giving too many extra cheap tokens which are likely to be dumped on market hurting all investors. Instead, we opt to pass on the discount to the later investors instead who in aggregate still pay a higher price and thus add more liquidity to the DEX benefiting everyone. Due to the dynamic price vs static SALE token allocations, there ends up being some amount of SALE token unallocated to anyone yet liquidity goal is still reached. Everyone still got exactly what they agreed to, but those orphaned SALE tokens are now harmlessly stuck forever in the fundraiser, unable to be dumped on open market. This is good for all investors.

Therefore the tradeoff is this:

- Refunds cause a little bit of SALE tokens to be unowned by anyone
- We could gift these extra SALE tokens to early investors, but it would increase sell pressure
- We could gift these extra SALE tokens to later investors, but it would be too unfair to early investors
- Thus we just leave the SALE tokens orphaned stuck inside the contract forever, which is effectively a burn and benefits all investors
- Later investors are the ones who end up paying slightly more for their tokens, which leads to stronger DEX liquidity

The amount of orphaned tokens depends on three (3) factors:

1. How steep the price bonding curve is (the bigger the difference between start vs end price, the more orphaned tokens)
2. How many refunds there are (more early refunds led to more orphaned tokens, up to a certain max, and then goes down)
3. How high the rake is (smaller rakes lead to more orphan tokens)

Overall the range of orphaned tokens is anywhere from 1% to 30%. The folder `scripts/orphan-tokens` contains simulations to demonstrate this phenomenon.

Here is the suggested range of setup params:

- End Price is ~2-3x the start price
- Upfront rake is ~10-20%, Escrow rake is unopinionated
- Don't have more than 10% refunds

This will keep your orphaned token rates ~15%.

If you decide that you want higher orphan token rates, just be aware that later investors end up paying higher price (but no more than your end price). This can be good for liquidity but bad for ease of sale getting the last chunk of tokens sold. We do not recommend you tailor your fundraising strategy around orphaned tokens, and try to minimize your refund rates. Orphan tokens are just another investor protection.

## Premature DEX Deployment

You may encounter difficulty reaching your fundraising goal, if it was set too high. Otterpad offers the ability to prematurely deploy liquidity to DEX so that your investors don't have to wait forever.

What happens:

- DEX price goes out with same full allocation of SALE tokens but less PAY liquidity, thus landing on DEX at much lower price
- All existing token buyers get a prorated share of the unsold tokens, increasing their tokens owned.

The implications are:

- The "market cap" of tokens going out will be much lower, since DEX price is lower than expected
- While DEX price might be lower, investors also get a lower effective price on their tokens (due to the bonus prorated tokens). From their ROI point of view, there is no difference.
- While liquidity on DEX ends up being lower, this is complimented by increased gains potential (much higher multiples)
- Founders still hold the same allocation of tokens as before (Whereas if the unsold tokens were burned, the founders would have too big of a share). This prevents an avenue of founder rug
- This setup is very favorable to investors and can create accidental whales as they receive prorated unsold tokens. Investors may pressure founders for earlier premature DEX deployment.
- Orphaned tokens from refunds are still locked forever

Overall premature DEX deployment is not a bad or scary thing. It's actually a fair safety mechanism that gives optionality to founders & reassurance to investors. Just beware of creating accidental whales.
