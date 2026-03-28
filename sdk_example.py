import requests

def get_github_user(username):
    """
    Fetches GitHub user information.
    """
    url = f"https://api.github.com/users/{username}"
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()
    else:
        return None

if __name__ == "__main__":
    username = "google"
    user_data = get_github_user(username)

    if user_data:
        print(f"Successfully fetched data for {user_data['name']}")
        print(f"Public Repos: {user_data['public_repos']}")
        print(f"Followers: {user_data['followers']}")
    else:
        print(f"Could not fetch data for user {username}")
