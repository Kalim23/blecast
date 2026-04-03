export default function ConnectionStatus({ isConnected, snapConnected, serverInfo }) {
  const connected = isConnected && snapConnected;
  const label = !isConnected
    ? 'Backend offline'
    : !snapConnected
    ? 'Connecting to Snapcast...'
    : 'Connected';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${
          connected ? 'bg-green-500' : 'bg-red-500 pulse'
        }`}
      />
      <span className={`text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {label}
      </span>
      {serverInfo?.snapserver && (
        <span className="text-xs text-gray-500 ml-1">
          v{serverInfo.snapserver.version}
        </span>
      )}
    </div>
  );
}
