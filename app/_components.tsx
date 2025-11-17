function Profile() :React.ReactElement {
    return <>
        <h2>hello world</h2>
        <p>This is a profile</p>
        <img src="https://via.placeholder.com/150" alt="profile" />
    </>
}

export function Gallery() :React.ReactElement {
    return (
        <section>
          <h1>了不起的科学家们</h1>
          <Profile />
          <Profile />
          <Profile />
        </section>
      );
}