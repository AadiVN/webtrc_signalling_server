import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final client = http.Client();

  listenToStream(
      client, 'http://localhost:3000/subscribe-iceCandidates', 'iceCandidates');
  listenToStream(client, 'http://localhost:3000/subscribe-answer', 'answer');
  listenToStream(client, 'http://localhost:3000/subscribe-offer', 'offer');
}

void listenToStream(http.Client client, String url, String streamName) async {
  try {
    final request = http.Request('GET', Uri.parse(url));
    final response = await client.send(request);

    if (response.statusCode == 200) {
      print('Connected to $streamName stream');
      response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
        (data) {
          if (data.startsWith('data: ')) {
            final jsonData = json.decode(data.substring(6));
            print('Received $streamName data: $jsonData');
          }
        },
        onError: (error) {
          print('Error listening to $streamName stream: $error');
        },
        onDone: () {
          print('$streamName stream closed');
        },
      );
    } else {
      print('Failed to connect to $streamName stream: ${response.statusCode}');
    }
  } catch (e) {
    print('Exception occurred while connecting to $streamName stream: $e');
  }
}
