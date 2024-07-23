import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final client = http.Client();

  final userId = 'user123'; // Example user ID, should be unique for each user

  listenToStream(client,
      'http://localhost:3000/subscribe-iceCandidates/$userId', 'iceCandidates');
  listenToStream(
      client, 'http://localhost:3000/subscribe-answer/$userId', 'answer');
  listenToStream(
      client, 'http://localhost:3000/subscribe-offer/$userId', 'offer');
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
