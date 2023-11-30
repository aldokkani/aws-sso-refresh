export function getCronExpression(input) {
  const regex = /(\d+)\s*([a-zA-Z]+)/;
  const matches = input.match(regex);

  if (matches?.length !== 3) throw new Error(`Invalid refreshEvery: ${input}`);

  const frequency = parseInt(matches[1], 10);
  if (Number.isNaN(frequency)) throw new Error(`Invalid refreshEvery: ${input}`);

  const unit = matches[2][0];

  switch (unit) {
    case 's':
      return `*/${frequency} * * * * *`;
    case 'm':
      return `0 */${frequency} * * * *`;
    case 'h':
      return `0 0 */${frequency} * * *`;
    default:
      throw new Error(`Invalid refreshEvery: ${input}`);
  }
}
