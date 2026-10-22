FROM debian:bookworm as motley_cue_pam_ssh

##### install dependencies
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    ssh \
    curl \
    gpg \
    netcat-openbsd
RUN echo deb [signed-by=/etc/apt/trusted.gpg.d/kitrepo-archive.gpg] https://repo.data.kit.edu//debian/bookworm ./ \
    >> /etc/apt/sources.list
RUN curl -fsSL https://repo.data.kit.edu/repo-data-kit-edu-key.gpg \
    | gpg --dearmor \
    > /etc/apt/trusted.gpg.d/kitrepo-archive.gpg
RUN apt-get update && apt-get install -y \
    pam-ssh-oidc-autoconfig motley-cue


##### ssh config
RUN rm -f /etc/ssh/ssh_host_*
RUN mkdir /run/sshd
RUN echo "Include /etc/ssh/sshd_config.d/*.conf" >> /etc/ssh/sshd_config \
    && echo "ChallengeResponseAuthentication yes" > /etc/ssh/sshd_config.d/oidc.conf

##### pam config
RUN sed -i "s/localhost/mc_endpoint/g" /etc/pam.d/pam-ssh-oidc-config.ini

##### motley-cue config
RUN rm /etc/motley_cue/motley_cue.conf  && rm /etc/motley_cue/feudal_adapter.conf \
    && ln -s /config_files/motley_cue.conf /etc/motley_cue/motley_cue.conf \
    && ln -s /config_files/feudal_adapter.conf /etc/motley_cue/feudal_adapter.conf
RUN echo ERROR_LOG=- >> /etc/motley_cue/motley_cue.env
RUN echo ACCESS_LOG=- >> /etc/motley_cue/motley_cue.env
##### OTP tokenmap db and keyfile locations (see motley_cue.conf);
##### must exist, be root-owned and not world-accessible
RUN mkdir -p /var/cache/motley_cue /var/lib/motley_cue \
    && chmod 700 /var/cache/motley_cue /var/lib/motley_cue

##### expose needed ports
EXPOSE 22

##### init cmd and entrypoint
COPY ./runner.sh /srv/runner.sh
COPY ./entrypoint.sh /srv/entrypoint.sh
RUN chmod +x /srv/runner.sh /srv/entrypoint.sh

ENTRYPOINT [ "/srv/entrypoint.sh" ]
CMD ["/srv/runner.sh"]
